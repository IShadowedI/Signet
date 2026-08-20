import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { orders } from "../../schema";
import { requireInternalAuth } from "../../auth";
import { erp } from "../../erp";

export const adminOrdersRouter = Router();
adminOrdersRouter.use(requireInternalAuth());

/** All orders across every tenant, most recent first. */
adminOrdersRouter.get("/", async (_req, res) => {
  const rows = await db.query.orders.findMany({
    orderBy: desc(orders.createdAt),
    with: { tenant: true, user: true, lines: true },
  });
  res.json(rows);
});

adminOrdersRouter.get("/:id", async (req, res) => {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, req.params.id),
    with: { tenant: true, user: true, lines: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json(order);
});

/** Re-submits an order to the ERP after a prior failure. */
adminOrdersRouter.post("/:id/retry", async (req, res) => {
  const order = await db.query.orders.findFirst({
    where: eq(orders.id, req.params.id),
    with: { tenant: true, lines: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });

  try {
    const result = await erp.submitOrder({
      customerCode: order.tenant.erpCustomerCode ?? order.tenant.slug,
      poNumber: order.poNumber ?? undefined,
      lines: order.lines.map((l) => ({ sku: l.variantSku, quantity: l.quantity })),
    });
    const [updated] = await db
      .update(orders)
      .set({ status: "submitted", erpOrderId: result.erpOrderId })
      .where(eq(orders.id, order.id))
      .returning();
    res.json(updated);
  } catch (e) {
    res.status(502).json({ error: "ERP submission failed", detail: String(e) });
  }
});
