import { Router } from "express";
import path from "node:path";
import { and, eq, inArray } from "drizzle-orm";
import { appendOrderToCsv } from "@signet/erp";
import { db } from "../db";
import {
  adhocRequests,
  invoicePayments,
  invoices,
  orders,
  paymentBatches,
  quoteComments,
  quoteLines,
  quotes,
  returnLines,
  returns,
  shipments,
  tenants,
} from "../schema";
import { erp } from "../erp";
import { requireBuyerAuth } from "../auth";

export const accountRouter = Router();

/**
 * Buyer self-service API (Signet's "frictionless self-service" tabs):
 * orders + approvals, invoices + payment, quotes, returns, ad-hoc requests,
 * and shipment tracking. Every route re-verifies the signed-in buyer belongs
 * to the tenant in the URL — never trust the :slug alone for access control.
 */

async function tenantForSlug(slug: string) {
  return db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
}

function isManager(role: string) {
  return role === "approver" || role === "admin";
}

accountRouter.use("/:slug", requireBuyerAuth, async (req, res, next) => {
  const tenant = await tenantForSlug(req.params.slug);
  if (!tenant) return res.status(404).json({ error: `Unknown storefront "${req.params.slug}"` });
  if (tenant.id !== req.buyerUser!.tenantId) return res.status(403).json({ error: "Forbidden" });
  res.locals.tenant = tenant;
  next();
});

// ---- Orders & approvals ----

accountRouter.get("/:slug/orders", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const manager = isManager(req.buyerUser!.role);
  const rows = await db.query.orders.findMany({
    where: manager
      ? eq(orders.tenantId, tenant.id)
      : and(eq(orders.tenantId, tenant.id), eq(orders.userId, req.buyerUser!.userId)),
    with: { lines: true, invoices: true, shipments: true },
  });
  res.json(rows);
});

accountRouter.post("/:slug/orders/:id/approve", async (req, res) => {
  if (!isManager(req.buyerUser!.role)) return res.status(403).json({ error: "Only approvers can approve orders" });
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;

  const order = await db.query.orders.findFirst({
    where: and(eq(orders.id, req.params.id), eq(orders.tenantId, tenant.id)),
    with: { lines: true },
  });
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "pending_approval") return res.status(409).json({ error: `Order is already ${order.status}` });

  try {
    const result = await erp.submitOrder({
      customerCode: tenant.erpCustomerCode ?? tenant.slug,
      poNumber: order.poNumber ?? undefined,
      lines: order.lines.map((l) => ({ sku: l.variantSku, quantity: l.quantity })),
    });
    const [updated] = await db
      .update(orders)
      .set({ status: "submitted", erpOrderId: result.erpOrderId, approvedByUserId: req.buyerUser!.userId, approvedAt: new Date() })
      .where(eq(orders.id, order.id))
      .returning();
    appendOrderToCsv(
      path.join(process.cwd(), "exports", "orders.csv"),
      order.lines.map((l) => ({
        orderId: order.id,
        createdAt: updated.createdAt.toISOString(),
        tenantSlug: tenant.slug,
        customerCode: tenant.erpCustomerCode ?? tenant.slug,
        poNumber: order.poNumber ?? undefined,
        paymentMethod: order.paymentMethod,
        sku: l.variantSku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        erpOrderId: updated.erpOrderId,
        status: updated.status,
      })),
    );
    res.json(updated);
  } catch {
    const [updated] = await db.update(orders).set({ status: "error" }).where(eq(orders.id, order.id)).returning();
    res.status(502).json({ error: "ERP submission failed", order: updated });
  }
});

accountRouter.post("/:slug/orders/:id/reject", async (req, res) => {
  if (!isManager(req.buyerUser!.role)) return res.status(403).json({ error: "Only approvers can reject orders" });
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const [updated] = await db
    .update(orders)
    .set({ status: "rejected", approvedByUserId: req.buyerUser!.userId, approvedAt: new Date() })
    .where(and(eq(orders.id, req.params.id), eq(orders.tenantId, tenant.id)))
    .returning();
  if (!updated) return res.status(404).json({ error: "Order not found" });
  res.json(updated);
});

// ---- Invoices & payment ----

accountRouter.get("/:slug/invoices", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const rows = await db.query.invoices.findMany({
    where: eq(invoices.tenantId, tenant.id),
    with: { payments: true },
  });
  const open = rows.filter((r) => r.status !== "paid" && r.status !== "void");
  res.json({
    openBalance: Math.round(open.reduce((s, r) => s + (r.amount - r.amountPaid), 0) * 100) / 100,
    invoices: rows.map((r) => ({
      ...r,
      balance: Math.round((r.amount - r.amountPaid) * 100) / 100,
      payable: r.status !== "paid" && r.status !== "void" && (!r.lockedUntil || r.lockedUntil < new Date()),
    })),
  });
});

/**
 * Settles one or more open invoices in a single transaction, with partial
 * amounts allowed — mirrors Signet's "tick the invoices, pay once" screen.
 */
accountRouter.post("/:slug/invoices/pay", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const { allocations, method, reference, memo } = req.body ?? {};
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ error: "allocations[] of { invoiceId, amount } is required" });
  }

  const ids = allocations.map((a: { invoiceId: string }) => a.invoiceId);
  const targets = await db.query.invoices.findMany({ where: inArray(invoices.id, ids) });
  if (targets.length !== ids.length) return res.status(404).json({ error: "One or more invoices not found" });
  if (targets.some((t) => t.tenantId !== tenant.id)) return res.status(403).json({ error: "Forbidden" });

  const now = new Date();
  const blocked = targets.find(
    (t) => t.status === "paid" || t.status === "void" || (t.lockedUntil && t.lockedUntil > now),
  );
  if (blocked) return res.status(409).json({ error: `Invoice ${blocked.invoiceNumber} is not payable` });

  let total = 0;
  for (const alloc of allocations) {
    const invoice = targets.find((t) => t.id === alloc.invoiceId)!;
    const amount = Number(alloc.amount);
    const balance = Math.round((invoice.amount - invoice.amountPaid) * 100) / 100;
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Allocation amounts must be > 0" });
    if (amount > balance + 0.005) return res.status(400).json({ error: `Allocation exceeds balance on ${invoice.invoiceNumber}` });
    total += amount;
  }
  if (total <= 0) return res.status(400).json({ error: "Payment total must be positive" });

  const payMethod = method === "allotment" ? "allotment" : method === "ach" ? "ach" : "card-token";
  const [batch] = await db
    .insert(paymentBatches)
    .values({
      tenantId: tenant.id,
      userId: req.buyerUser!.userId,
      amount: Math.round(total * 100) / 100,
      method: payMethod,
      status: "settled",
      reference: reference ?? null,
      memo: memo ?? null,
      settledAt: now,
    })
    .returning();

  for (const alloc of allocations) {
    const invoice = targets.find((t) => t.id === alloc.invoiceId)!;
    const amount = Math.round(Number(alloc.amount) * 100) / 100;
    await db.insert(invoicePayments).values({
      invoiceId: invoice.id,
      batchId: batch.id,
      amount,
      method: payMethod,
      status: "settled",
      reference: reference ?? null,
      memo: memo ?? null,
    });

    const amountPaid = Math.round((invoice.amountPaid + amount) * 100) / 100;
    const paidOff = amountPaid >= invoice.amount - 0.005;
    await db
      .update(invoices)
      .set({
        amountPaid,
        status: paidOff ? "paid" : "partially_paid",
        ...(paidOff ? { paidAt: now } : {}),
        // Settled receipts release immediately; only unsettled ones hold the invoice.
        lockedUntil: batch.status === "settled" ? null : new Date(Date.now() + 4 * 86_400_000),
      })
      .where(eq(invoices.id, invoice.id));
  }

  res.status(201).json({ batch, appliedTo: ids.length });
});

// ---- Quotes ----

accountRouter.get("/:slug/quotes", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const manager = isManager(req.buyerUser!.role);
  const rows = await db.query.quotes.findMany({
    where: manager
      ? eq(quotes.tenantId, tenant.id)
      : and(eq(quotes.tenantId, tenant.id), eq(quotes.userId, req.buyerUser!.userId)),
    with: { lines: true, comments: true },
  });
  res.json(rows);
});

accountRouter.post("/:slug/quotes", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const { lines, notes, submitToRep } = req.body ?? {};
  if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ error: "lines[] is required" });

  const total =
    Math.round(lines.reduce((s: number, l: { quantity: number; unitPrice?: number }) => s + l.quantity * (l.unitPrice ?? 0), 0) * 100) / 100;

  const [quote] = await db
    .insert(quotes)
    .values({
      tenantId: tenant.id,
      userId: req.buyerUser!.userId,
      quoteNumber: `Q-${Date.now()}`,
      // "Submit to Sales Rep for Help" queues it with a worker; otherwise it stays the buyer's draft.
      status: submitToRep ? "rep_queued" : "user_saved",
      total,
      notes,
    })
    .returning();
  await db.insert(quoteLines).values(
    lines.map((l: { sku: string; description?: string; quantity: number; unitPrice?: number }) => ({
      quoteId: quote.id,
      sku: l.sku,
      description: l.description,
      quantity: l.quantity,
      unitPrice: l.unitPrice ?? 0,
    })),
  );
  res.status(201).json(quote);
});

/** Buyer-side workflow buttons: save, send to rep, or archive their own quote. */
accountRouter.post("/:slug/quotes/:id/action/:action", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const next = { save: "user_saved", submit_to_rep: "rep_queued", archive: "cancelled" }[req.params.action];
  if (!next) return res.status(400).json({ error: "Unknown action. Try: save, submit_to_rep, archive" });

  const quote = await db.query.quotes.findFirst({
    where: and(eq(quotes.id, req.params.id), eq(quotes.tenantId, tenant.id)),
  });
  if (!quote) return res.status(404).json({ error: "Quote not found" });
  if (quote.status === "converted") return res.status(409).json({ error: "Converted quotes are read-only" });
  if (!isManager(req.buyerUser!.role) && quote.userId !== req.buyerUser!.userId) {
    return res.status(403).json({ error: "Forbidden" });
  }

  if (req.body?.comment) {
    await db.insert(quoteComments).values({
      quoteId: quote.id,
      authorType: "contact",
      authorEmail: null,
      body: String(req.body.comment),
    });
  }

  const [updated] = await db
    .update(quotes)
    .set({ status: next, updatedAt: new Date() })
    .where(eq(quotes.id, quote.id))
    .returning();
  res.json(updated);
});

// ---- Returns ----

accountRouter.get("/:slug/returns", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const manager = isManager(req.buyerUser!.role);
  const rows = await db.query.returns.findMany({
    where: manager
      ? eq(returns.tenantId, tenant.id)
      : and(eq(returns.tenantId, tenant.id), eq(returns.userId, req.buyerUser!.userId)),
    with: { lines: true },
  });
  res.json(rows);
});

accountRouter.post("/:slug/returns", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const { orderId, reason, lines, carrier, trackingNumber } = req.body ?? {};
  if (!Array.isArray(lines) || lines.length === 0) return res.status(400).json({ error: "lines[] is required" });

  const [ret] = await db
    .insert(returns)
    .values({
      tenantId: tenant.id,
      orderId,
      userId: req.buyerUser!.userId,
      reason,
      carrier: carrier ?? null,
      trackingNumber: trackingNumber ?? null,
    })
    .returning();
  await db.insert(returnLines).values(
    lines.map((l: { variantSku: string; quantity: number; reason?: string; action?: string; unitPrice?: number }) => ({
      returnId: ret.id,
      variantSku: l.variantSku,
      quantity: l.quantity,
      reason: l.reason,
      action: l.action ?? null,
      unitPrice: l.unitPrice ?? 0,
    })),
  );
  res.status(201).json(ret);
});

// ---- Ad-hoc requests (samples, artwork, anything that isn't an order/return) ----

accountRouter.get("/:slug/adhoc-requests", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const manager = isManager(req.buyerUser!.role);
  const rows = await db.query.adhocRequests.findMany({
    where: manager
      ? eq(adhocRequests.tenantId, tenant.id)
      : and(eq(adhocRequests.tenantId, tenant.id), eq(adhocRequests.userId, req.buyerUser!.userId)),
  });
  res.json(rows);
});

accountRouter.post("/:slug/adhoc-requests", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const { type, subject, details } = req.body ?? {};
  if (!type || !subject) return res.status(400).json({ error: "type and subject are required" });
  const [row] = await db
    .insert(adhocRequests)
    .values({ tenantId: tenant.id, userId: req.buyerUser!.userId, type, subject, details })
    .returning();
  res.status(201).json(row);
});

// ---- Shipment tracking ----

accountRouter.get("/:slug/shipments", async (req, res) => {
  const tenant = res.locals.tenant as typeof tenants.$inferSelect;
  const rows = await db.query.shipments.findMany({ where: eq(shipments.tenantId, tenant.id) });
  res.json(rows);
});
