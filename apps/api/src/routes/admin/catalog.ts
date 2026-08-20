import { Router } from "express";
import { eq } from "drizzle-orm";
import { db } from "../../db";
import { tenantProducts, tenants } from "../../schema";
import { requireInternalAuth } from "../../auth";

export const adminCatalogRouter = Router();
adminCatalogRouter.use(requireInternalAuth());

/** A tenant's catalog: which products they carry, with price overrides. */
adminCatalogRouter.get("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const rows = await db.query.tenantProducts.findMany({
    where: eq(tenantProducts.tenantId, tenant.id),
    with: { product: { with: { variants: true } } },
  });
  res.json(rows);
});

/** Adds a product to a tenant's catalog (optionally with contract pricing). */
adminCatalogRouter.post("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const { productId, priceOverride, allotmentEligible } = req.body ?? {};
  if (!productId) return res.status(400).json({ error: "productId is required" });

  const [row] = await db
    .insert(tenantProducts)
    .values({
      tenantId: tenant.id,
      productId,
      priceOverride: priceOverride ?? null,
      allotmentEligible: allotmentEligible ?? true,
    })
    .onConflictDoUpdate({
      target: [tenantProducts.tenantId, tenantProducts.productId],
      set: { priceOverride: priceOverride ?? null, allotmentEligible: allotmentEligible ?? true },
    })
    .returning();
  res.status(201).json(row);
});

/** Updates price override / allotment eligibility for a tenant-product row. */
adminCatalogRouter.patch("/:slug/:tenantProductId", async (req, res) => {
  const { priceOverride, allotmentEligible } = req.body ?? {};
  const [updated] = await db
    .update(tenantProducts)
    .set({
      ...(priceOverride !== undefined && { priceOverride }),
      ...(allotmentEligible !== undefined && { allotmentEligible }),
    })
    .where(eq(tenantProducts.id, req.params.tenantProductId))
    .returning();
  if (!updated) return res.status(404).json({ error: "Not found" });
  res.json(updated);
});

/** Removes a product from a tenant's catalog. */
adminCatalogRouter.delete("/:slug/:tenantProductId", async (req, res) => {
  await db.delete(tenantProducts).where(eq(tenantProducts.id, req.params.tenantProductId));
  res.json({ ok: true });
});
