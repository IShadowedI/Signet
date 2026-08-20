import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { orderLines, orders, quoteComments, quoteLines, quotes, tenants } from "../../schema";
import { requireInternalAuth } from "../../auth";
import { documentNumber, staffEmail } from "./helpers";

export const adminQuotesRouter = Router();
adminQuotesRouter.use(requireInternalAuth());

/**
 * Signet's quote lifecycle: a quote ping-pongs between the sales rep (worker)
 * and the contact (buyer) until it is placed or archived. Unlike Signet we
 * keep the record after conversion (`converted`) so history isn't lost.
 */
export const QUOTE_STATUSES = [
  "rep_new",
  "rep_saved",
  "rep_queued",
  "user_queued",
  "user_saved",
  "cancelled",
  "converted",
] as const;
type QuoteStatus = (typeof QUOTE_STATUSES)[number];

/** Worker-side actions and the stage each one moves the quote into. */
const WORKER_ACTIONS: Record<string, QuoteStatus> = {
  save: "rep_saved",
  return_to_user: "user_queued",
  cancel_return_to_user: "rep_saved",
  archive: "cancelled",
};

const OPEN_STATUSES: QuoteStatus[] = ["rep_new", "rep_saved", "rep_queued", "user_queued", "user_saved"];

function lineTotal(lines: { quantity: number; unitPrice: number }[]): number {
  return Math.round(lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
}

function isExpired(q: { expiresAt: Date | null; status: string }): boolean {
  return Boolean(q.expiresAt && q.expiresAt < new Date() && OPEN_STATUSES.includes(q.status as QuoteStatus));
}

adminQuotesRouter.get("/", async (_req, res) => {
  const rows = await db.query.quotes.findMany({
    orderBy: desc(quotes.updatedAt),
    with: {
      tenant: true,
      user: true,
      lines: true,
      comments: { orderBy: asc(quoteComments.createdAt) },
    },
  });
  res.json(
    rows.map((q) => ({
      ...q,
      total: q.total || lineTotal(q.lines),
      expired: isExpired(q),
      awaitingRep: q.status === "rep_queued" || q.status === "rep_new",
    })),
  );
});

adminQuotesRouter.get("/:id", async (req, res) => {
  const row = await db.query.quotes.findFirst({
    where: eq(quotes.id, req.params.id),
    with: { tenant: true, user: true, lines: true, comments: { orderBy: asc(quoteComments.createdAt) } },
  });
  if (!row) return res.status(404).json({ error: "Quote not found" });
  res.json({ ...row, expired: isExpired(row) });
});

/** A rep builds a quote for a customer from scratch (CRM Workspace → Create a Quote). */
adminQuotesRouter.post("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const { userId, lines, notes, expiresInDays } = req.body ?? {};
  const email = await staffEmail(req);
  const parsedLines: { sku: string; description?: string; quantity: number; unitPrice: number }[] = Array.isArray(lines)
    ? lines
    : [];

  const [quote] = await db
    .insert(quotes)
    .values({
      tenantId: tenant.id,
      userId: userId || null,
      quoteNumber: documentNumber("Q"),
      status: "rep_new",
      assignedWorkerEmail: email,
      notes: notes || null,
      total: lineTotal(parsedLines),
      expiresAt: expiresInDays ? new Date(Date.now() + Number(expiresInDays) * 86_400_000) : null,
    })
    .returning();

  if (parsedLines.length > 0) {
    await db.insert(quoteLines).values(
      parsedLines.map((l) => ({
        quoteId: quote.id,
        sku: l.sku,
        description: l.description ?? null,
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
      })),
    );
  }
  res.status(201).json(quote);
});

/** Replaces the quote's lines and bumps its revision number. */
adminQuotesRouter.put("/:id/lines", async (req, res) => {
  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, req.params.id) });
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  if (quote.status === "converted") return res.status(409).json({ error: "Converted quotes are read-only" });

  const lines: { sku: string; description?: string; quantity: number; unitPrice: number }[] = req.body?.lines ?? [];
  await db.delete(quoteLines).where(eq(quoteLines.quoteId, quote.id));
  if (lines.length > 0) {
    await db.insert(quoteLines).values(
      lines.map((l) => ({
        quoteId: quote.id,
        sku: l.sku,
        description: l.description ?? null,
        quantity: Number(l.quantity) || 1,
        unitPrice: Number(l.unitPrice) || 0,
      })),
    );
  }

  const [updated] = await db
    .update(quotes)
    .set({ total: lineTotal(lines), version: quote.version + 1, updatedAt: new Date() })
    .where(eq(quotes.id, quote.id))
    .returning();
  res.json(updated);
});

adminQuotesRouter.patch("/:id", async (req, res) => {
  const { status, notes, expiresAt, assignedWorkerEmail } = req.body ?? {};
  if (status && !QUOTE_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const [row] = await db
    .update(quotes)
    .set({
      ...(status ? { status } : {}),
      ...(notes !== undefined ? { notes } : {}),
      ...(assignedWorkerEmail !== undefined ? { assignedWorkerEmail } : {}),
      ...(expiresAt !== undefined ? { expiresAt: expiresAt ? new Date(expiresAt) : null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(quotes.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Quote not found" });
  res.json(row);
});

/**
 * The rep-side workflow buttons. Each optionally carries a comment, which is
 * appended to the quote's conversation log exactly like Signet's quote emails.
 */
adminQuotesRouter.post("/:id/action/:action", async (req, res) => {
  const next = WORKER_ACTIONS[req.params.action];
  if (!next) return res.status(400).json({ error: `Unknown action. Try: ${Object.keys(WORKER_ACTIONS).join(", ")}` });

  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, req.params.id) });
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  if (quote.status === "converted") return res.status(409).json({ error: "Converted quotes are read-only" });

  const email = await staffEmail(req);
  if (req.body?.comment) {
    await db.insert(quoteComments).values({
      quoteId: quote.id,
      authorType: "worker",
      authorEmail: email,
      body: String(req.body.comment),
    });
  }

  const [updated] = await db
    .update(quotes)
    .set({ status: next, assignedWorkerEmail: email ?? quote.assignedWorkerEmail, updatedAt: new Date() })
    .where(eq(quotes.id, quote.id))
    .returning();
  res.json(updated);
});

adminQuotesRouter.post("/:id/comments", async (req, res) => {
  const body = req.body?.body;
  if (!body) return res.status(400).json({ error: "body is required" });
  const [row] = await db
    .insert(quoteComments)
    .values({ quoteId: req.params.id, authorType: "worker", authorEmail: await staffEmail(req), body: String(body) })
    .returning();
  res.status(201).json(row);
});

/** "Place Order" — converts the quote to an order and keeps the quote for history. */
adminQuotesRouter.post("/:id/convert-to-order", async (req, res) => {
  const quote = await db.query.quotes.findFirst({ where: eq(quotes.id, req.params.id), with: { lines: true } });
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  if (quote.status === "converted") return res.status(409).json({ error: "Quote has already been converted" });
  if (quote.status === "cancelled") return res.status(409).json({ error: "Cancelled quotes cannot be placed" });
  if (quote.lines.length === 0) return res.status(400).json({ error: "Quote has no lines" });
  if (isExpired(quote)) return res.status(409).json({ error: "Quote has expired — extend it before placing" });

  const [order] = await db
    .insert(orders)
    .values({ tenantId: quote.tenantId, userId: quote.userId, status: "pending", paymentMethod: "po" })
    .returning();
  await db.insert(orderLines).values(
    quote.lines.map((l) => ({ orderId: order.id, variantSku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice })),
  );
  await db
    .update(quotes)
    .set({ status: "converted", convertedOrderId: order.id, updatedAt: new Date() })
    .where(eq(quotes.id, quote.id));

  res.status(201).json(order);
});
