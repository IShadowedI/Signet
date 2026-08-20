import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { shipments, tenants } from "../../schema";
import { requireInternalAuth } from "../../auth";

export const adminShipmentsRouter = Router();
adminShipmentsRouter.use(requireInternalAuth());

/** All shipments across every tenant, most recent first. */
adminShipmentsRouter.get("/", async (_req, res) => {
  const rows = await db.query.shipments.findMany({
    orderBy: desc(shipments.shippedAt),
    with: { tenant: true, order: true },
  });
  res.json(rows);
});

/** Creates/attaches tracking info for an order. */
adminShipmentsRouter.post("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const { orderId, carrier, trackingNumber } = req.body ?? {};
  if (!orderId) return res.status(400).json({ error: "orderId is required" });

  const [row] = await db
    .insert(shipments)
    .values({ tenantId: tenant.id, orderId, carrier, trackingNumber, status: "shipped", shippedAt: new Date() })
    .returning();
  res.status(201).json(row);
});

adminShipmentsRouter.patch("/:id", async (req, res) => {
  const { status, carrier, trackingNumber } = req.body ?? {};
  const [row] = await db
    .update(shipments)
    .set({
      ...(status ? { status } : {}),
      ...(carrier !== undefined ? { carrier } : {}),
      ...(trackingNumber !== undefined ? { trackingNumber } : {}),
      ...(status === "delivered" ? { deliveredAt: new Date() } : {}),
    })
    .where(eq(shipments.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Shipment not found" });
  res.json(row);
});
