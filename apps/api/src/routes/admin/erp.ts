import { Router } from "express";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { products, productVariants, punchoutSessions, tenants } from "../../schema";
import { requireInternalAuth } from "../../auth";
import { erp } from "../../erp";

export const adminErpRouter = Router();
adminErpRouter.use(requireInternalAuth());

/**
 * Pulls products + variants from the active ERP into the commerce core. In
 * production this runs on a schedule / webhook rather than on demand, but the
 * mapping logic is the same.
 */
adminErpRouter.post("/sync/products", async (_req, res) => {
  const erpProducts = await erp.listProducts();
  let variantCount = 0;

  for (const p of erpProducts) {
    const [product] = await db
      .insert(products)
      .values({
        erpId: p.erpId,
        sku: p.sku,
        name: p.name,
        description: p.description,
        brand: p.brand,
        imageUrl: p.imageUrl,
      })
      .onConflictDoUpdate({
        target: products.erpId,
        set: { sku: p.sku, name: p.name, description: p.description, brand: p.brand, imageUrl: p.imageUrl },
      })
      .returning();

    for (const v of p.variants) {
      await db
        .insert(productVariants)
        .values({
          productId: product.id,
          sku: v.sku,
          size: v.size,
          color: v.color,
          price: v.price,
          available: v.available,
        })
        .onConflictDoUpdate({
          target: productVariants.sku,
          set: { size: v.size, color: v.color, price: v.price, available: v.available },
        });
      variantCount++;
    }
  }

  res.json({ provider: erp.name, products: erpProducts.length, variants: variantCount });
});

/** Connectivity check for the active ERP provider. */
adminErpRouter.get("/health", async (_req, res) => {
  const ok = await erp.ping();
  res.json({ provider: erp.name, reachable: ok });
});

/** Punchout sessions for a tenant, for troubleshooting inbound cXML setups. */
adminErpRouter.get("/punchout/:slug/sessions", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  const rows = await db.query.punchoutSessions.findMany({
    where: eq(punchoutSessions.tenantId, tenant.id),
    orderBy: desc(punchoutSessions.createdAt),
    limit: 50,
  });
  res.json(rows);
});

/**
 * Downloads the universal CSV ERP sync file — one row per order line,
 * written regardless of which ErpProvider is active. Any ERP that accepts
 * CSV import (Acumatica, Sage 100, NetSuite, ...) can consume this directly.
 */
adminErpRouter.get("/orders-csv", (_req, res) => {
  const filePath = path.join(process.cwd(), "exports", "orders.csv");
  if (!existsSync(filePath)) {
    return res.type("text/csv").send("OrderID,CreatedAt,TenantSlug,CustomerCode,PONumber,PaymentMethod,SKU,Quantity,UnitPrice,ExtendedPrice,ERPOrderID,Status\n");
  }
  res.setHeader("Content-Disposition", "attachment; filename=orders.csv");
  res.type("text/csv").send(readFileSync(filePath, "utf-8"));
});
