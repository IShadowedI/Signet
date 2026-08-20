import { Router } from "express";
import { asc, eq, isNull, or } from "drizzle-orm";
import { randomBytes } from "node:crypto";
import { db } from "../../db";
import { tenants } from "../../schema";
import { internalTenantId, requireInternalAuth } from "../../auth";

export const adminTenantsRouter = Router();
adminTenantsRouter.use(requireInternalAuth());

/** Lists all client storefronts — the "Customer Sites" workspace from Signet. */
adminTenantsRouter.get("/", async (req, res) => {
  const scopedTenantId = internalTenantId(req);
  const rows = await db.query.tenants.findMany({
    where: scopedTenantId ? or(eq(tenants.id, scopedTenantId), eq(tenants.parentTenantId, scopedTenantId)) : isNull(tenants.parentTenantId),
    orderBy: asc(tenants.name),
    with: { catalog: true, users: true, orders: true },
  });
  res.json(
    rows.map((t) => ({
      slug: t.slug,
      name: t.name,
      domain: t.domain,
      erpCustomerCode: t.erpCustomerCode,
      primaryColor: t.primaryColor,
      accentColor: t.accentColor,
      punchoutEnabled: t.punchoutEnabled,
      requireApproval: t.requireApproval,
      products: t.catalog.length,
      users: t.users.length,
      orders: t.orders.length,
    })),
  );
});

/** Full detail for one tenant, including branding + page-builder blocks. */
adminTenantsRouter.get("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({
    where: or(eq(tenants.slug, req.params.slug), eq(tenants.domain, req.params.slug)),
  });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  const scopedTenantId = internalTenantId(req);
  if (scopedTenantId && tenant.id !== scopedTenantId && tenant.parentTenantId !== scopedTenantId) return res.status(403).json({ error: "Forbidden" });
  res.json(tenant);
});

/** Creates a new client storefront ("onboard a new client" action). */
adminTenantsRouter.post("/", async (req, res) => {
  const { slug, name, domain, erpCustomerCode } = req.body ?? {};
  if (!slug || !name) return res.status(400).json({ error: "slug and name are required" });
  const scopedTenantId = internalTenantId(req);

  const [tenant] = await db
    .insert(tenants)
    .values({ slug, name, domain: domain || null, erpCustomerCode: erpCustomerCode || null, parentTenantId: scopedTenantId })
    .returning();
  res.status(201).json(tenant);
});

/** Updates branding + homepage page-builder blocks for a tenant. */
adminTenantsRouter.patch("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const {
    name,
    domain,
    erpCustomerCode,
    primaryColor,
    accentColor,
    logoUrl,
    heroHeadline,
    heroSubtext,
    pageBlocks,
    requireApproval,
    approvalThreshold,
  } = req.body ?? {};

  const [updated] = await db
    .update(tenants)
    .set({
      ...(name !== undefined && { name }),
      ...(domain !== undefined && { domain: domain || null }),
      ...(erpCustomerCode !== undefined && { erpCustomerCode: erpCustomerCode || null }),
      ...(primaryColor !== undefined && { primaryColor }),
      ...(accentColor !== undefined && { accentColor }),
      ...(logoUrl !== undefined && { logoUrl }),
      ...(heroHeadline !== undefined && { heroHeadline }),
      ...(heroSubtext !== undefined && { heroSubtext }),
      ...(pageBlocks !== undefined && { pageBlocks }),
      ...(requireApproval !== undefined && { requireApproval: Boolean(requireApproval) }),
      ...(approvalThreshold !== undefined && { approvalThreshold: Number(approvalThreshold) }),
    })
    .where(eq(tenants.id, tenant.id))
    .returning();

  res.json(updated);
});

/** Enables punchout for a tenant and (re)generates its shared secret. */
adminTenantsRouter.post("/:slug/punchout/enable", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const secret = randomBytes(24).toString("hex");
  const [updated] = await db
    .update(tenants)
    .set({ punchoutEnabled: true, punchoutSharedSecret: secret })
    .where(eq(tenants.id, tenant.id))
    .returning();
  res.json(updated);
});

adminTenantsRouter.post("/:slug/punchout/disable", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const [updated] = await db
    .update(tenants)
    .set({ punchoutEnabled: false })
    .where(eq(tenants.id, tenant.id))
    .returning();
  res.json(updated);
});
