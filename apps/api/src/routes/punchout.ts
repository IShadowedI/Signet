import { Router } from "express";
import { randomUUID } from "node:crypto";
import { XMLParser } from "fast-xml-parser";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { punchoutSessions, tenants } from "../schema";

export const punchoutRouter = Router();

const STOREFRONT_URL = process.env.STOREFRONT_URL ?? "http://localhost:3000";
const xmlParser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Entry point for a buyer's procurement system (Ariba, Coupa, ...) starting a
 * punchout session (cXML PunchOutSetupRequest). Accepts either raw cXML
 * (Content-Type text/xml) or a simplified JSON body for local testing:
 *   { sharedSecret, buyerCookie, browserFormPostUrl }
 *
 * This is a scaffold: real buyer systems vary in header/credential structure,
 * so field extraction should be hardened against the specific buyer's cXML
 * once a punchout partner is confirmed.
 */
punchoutRouter.post("/:slug/setup", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant || !tenant.punchoutEnabled) {
    return res.status(404).json({ error: "Punchout is not enabled for this tenant" });
  }

  const isXml = typeof req.body === "string" || req.is("text/xml") || req.is("application/xml");
  let sharedSecret: string | undefined;
  let buyerCookie: string | undefined;
  let browserFormPostUrl: string | undefined;

  if (isXml) {
    const rawBody = typeof req.body === "string" ? req.body : "";
    let parsed: any;
    try {
      parsed = xmlParser.parse(rawBody);
    } catch {
      return res.status(400).json({ error: "Malformed cXML" });
    }
    const cxml = parsed?.cXML;
    sharedSecret = cxml?.Header?.Sender?.Credential?.SharedSecret;
    const setupReq = cxml?.Request?.PunchOutSetupRequest;
    buyerCookie = setupReq?.BuyerCookie;
    browserFormPostUrl = setupReq?.BrowserFormPost?.URL;
  } else {
    ({ sharedSecret, buyerCookie, browserFormPostUrl } = req.body ?? {});
  }

  if (!tenant.punchoutSharedSecret || sharedSecret !== tenant.punchoutSharedSecret) {
    return res.status(401).json({ error: "Invalid punchout shared secret" });
  }
  if (!browserFormPostUrl) {
    return res.status(400).json({ error: "browserFormPostUrl (BrowserFormPost/URL) is required" });
  }

  const token = randomUUID();
  await db.insert(punchoutSessions).values({
    tenantId: tenant.id,
    token,
    buyerCookie: buyerCookie ?? null,
    browserFormPostUrl,
    status: "open",
  });

  const startPageUrl = `${STOREFRONT_URL}/?tenant=${encodeURIComponent(tenant.slug)}&punchout=${token}`;

  if (isXml) {
    res.type("application/xml").send(`<?xml version="1.0" encoding="UTF-8"?>
<cXML payloadID="${Date.now()}@signet" xml:lang="en-US">
  <Response>
    <Status code="200" text="OK"/>
    <PunchOutSetupResponse>
      <StartPage><URL>${escapeXml(startPageUrl)}</URL></StartPage>
    </PunchOutSetupResponse>
  </Response>
</cXML>`);
  } else {
    res.json({ token, startPageUrl });
  }
});

/** Lets the storefront confirm it's in punchout mode and which tenant/session. */
punchoutRouter.get("/session/:token", async (req, res) => {
  const session = await db.query.punchoutSessions.findFirst({ where: eq(punchoutSessions.token, req.params.token) });
  if (!session) return res.status(404).json({ error: "Unknown punchout session" });
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.id, session.tenantId) });
  res.json({ status: session.status, tenantSlug: tenant?.slug });
});

/**
 * Called when the buyer finishes shopping in punchout mode: builds a
 * PunchOutOrderMessage and posts it back to the buyer's procurement system.
 */
punchoutRouter.post("/session/:token/return", async (req, res) => {
  const session = await db.query.punchoutSessions.findFirst({ where: eq(punchoutSessions.token, req.params.token) });
  if (!session) return res.status(404).json({ error: "Unknown punchout session" });
  if (session.status !== "open") return res.status(409).json({ error: `Session already ${session.status}` });

  const { lines } = req.body ?? {};
  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "lines[] is required" });
  }

  const items = (lines as { sku: string; quantity: number; unitPrice: number; description?: string }[])
    .map(
      (l, i) => `
      <ItemIn quantity="${Number(l.quantity)}">
        <ItemID><SupplierPartID>${escapeXml(l.sku)}</SupplierPartID></ItemID>
        <ItemDetail>
          <UnitPrice><Money currency="USD">${Number(l.unitPrice).toFixed(2)}</Money></UnitPrice>
          <Description xml:lang="en-US">${escapeXml(l.description ?? l.sku)}</Description>
          <UnitOfMeasure>EA</UnitOfMeasure>
        </ItemDetail>
      </ItemIn>`,
    )
    .join("");

  const cxml = `<?xml version="1.0" encoding="UTF-8"?>
<cXML payloadID="${Date.now()}@signet" xml:lang="en-US">
  <Message>
    <PunchOutOrderMessage>
      <BuyerCookie>${escapeXml(session.buyerCookie ?? "")}</BuyerCookie>
      <PunchOutOrderMessageHeader operationAllowed="create">
        <Total><Money currency="USD">${lines
          .reduce((sum: number, l: any) => sum + Number(l.quantity) * Number(l.unitPrice), 0)
          .toFixed(2)}</Money></Total>
      </PunchOutOrderMessageHeader>
      ${items}
    </PunchOutOrderMessage>
  </Message>
</cXML>`;

  try {
    const response = await fetch(session.browserFormPostUrl, {
      method: "POST",
      headers: { "Content-Type": "application/xml" },
      body: cxml,
    });
    await db
      .update(punchoutSessions)
      .set({ status: "returned" })
      .where(eq(punchoutSessions.id, session.id));
    res.json({ ok: true, postedTo: session.browserFormPostUrl, buyerStatus: response.status });
  } catch (e) {
    res.status(502).json({ error: "Failed to POST PunchOutOrderMessage to buyer system", detail: String(e) });
  }
});
