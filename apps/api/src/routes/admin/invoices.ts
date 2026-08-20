import { Router } from "express";
import { and, desc, eq, inArray, lt, ne } from "drizzle-orm";
import { db } from "../../db";
import { invoicePayments, invoices, paymentBatches, tenants } from "../../schema";
import { internalTenantId, requireInternalAuth } from "../../auth";
import { documentNumber, staffEmail } from "./helpers";

export const adminInvoicesRouter = Router();
adminInvoicesRouter.use(requireInternalAuth());

/**
 * Invoice pipeline mirrors Signet's "Pay Invoices Online" module:
 *   open -> partially_paid -> paid, with past_due, locked and void as side states.
 * Doc types follow the ERP: IN (invoice), CM (credit memo), FC (finance charge).
 */
export const INVOICE_STATUSES = ["open", "partially_paid", "paid", "past_due", "locked", "void"] as const;
export const INVOICE_TYPES = ["IN", "CM", "FC"] as const;

/** An invoice is payable only while open/partially paid/past due and not locked. */
function isPayable(inv: typeof invoices.$inferSelect): boolean {
  if (inv.status === "paid" || inv.status === "void" || inv.status === "locked") return false;
  return !inv.lockedUntil || inv.lockedUntil < new Date();
}

function derivedStatus(amount: number, amountPaid: number, dueDate: Date | null): string {
  if (amountPaid >= amount - 0.005) return "paid";
  if (amountPaid > 0) return "partially_paid";
  if (dueDate && dueDate < new Date()) return "past_due";
  return "open";
}

/** Flags anything past its due date so the AR list and aging report stay accurate. */
async function refreshPastDue() {
  await db
    .update(invoices)
    .set({ status: "past_due" })
    .where(and(eq(invoices.status, "open"), lt(invoices.dueDate, new Date())));
}

adminInvoicesRouter.get("/", async (req, res) => {
  await refreshPastDue();
  const scopedTenantId = internalTenantId(req);
  const rows = await db.query.invoices.findMany({
    ...(scopedTenantId ? { where: eq(invoices.tenantId, scopedTenantId) } : {}),
    orderBy: desc(invoices.issuedAt),
    with: { tenant: true, order: true, payments: true },
  });
  res.json(rows.map((inv) => ({ ...inv, balance: round(inv.amount - inv.amountPaid), payable: isPayable(inv) })));
});

/** Aging buckets (current / 1-30 / 31-60 / 61-90 / 90+), Signet's Invoice Aging report. */
adminInvoicesRouter.get("/aging", async (_req, res) => {
  await refreshPastDue();
  const rows = await db.query.invoices.findMany({ where: ne(invoices.status, "void"), with: { tenant: true } });

  const buckets: Record<string, { current: number; d30: number; d60: number; d90: number; d90plus: number }> = {};
  for (const inv of rows) {
    const balance = round(inv.amount - inv.amountPaid);
    if (balance <= 0) continue;
    const key = inv.tenant?.name ?? "Unknown";
    buckets[key] ??= { current: 0, d30: 0, d60: 0, d90: 0, d90plus: 0 };
    const daysLate = inv.dueDate ? Math.floor((Date.now() - inv.dueDate.getTime()) / 86_400_000) : 0;
    const bucket =
      daysLate <= 0 ? "current" : daysLate <= 30 ? "d30" : daysLate <= 60 ? "d60" : daysLate <= 90 ? "d90" : "d90plus";
    buckets[key][bucket] = round(buckets[key][bucket] + balance);
  }
  res.json(Object.entries(buckets).map(([tenant, b]) => ({ tenant, ...b })));
});

/** Per-client account statement: open items plus every payment applied. */
adminInvoicesRouter.get("/statement/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const rows = await db.query.invoices.findMany({
    where: eq(invoices.tenantId, tenant.id),
    orderBy: desc(invoices.issuedAt),
    with: { payments: true },
  });
  const openBalance = round(
    rows.filter((r) => r.status !== "void" && r.status !== "paid").reduce((s, r) => s + (r.amount - r.amountPaid), 0),
  );
  res.json({ tenant: { slug: tenant.slug, name: tenant.name }, openBalance, invoices: rows });
});

adminInvoicesRouter.post("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const { orderId, invoiceNumber, invoiceType, amount, dueDate, poNumber, terms, memo } = req.body ?? {};
  const value = Number(amount);
  if (!Number.isFinite(value)) return res.status(400).json({ error: "amount must be a number" });
  if (invoiceType && !INVOICE_TYPES.includes(invoiceType)) return res.status(400).json({ error: "Invalid invoiceType" });

  const [row] = await db
    .insert(invoices)
    .values({
      tenantId: tenant.id,
      orderId: orderId || null,
      invoiceNumber: invoiceNumber || documentNumber("INV"),
      invoiceType: invoiceType ?? "IN",
      amount: value,
      poNumber: poNumber || null,
      terms: terms || null,
      memo: memo || null,
      dueDate: dueDate ? new Date(dueDate) : null,
    })
    .returning();
  res.status(201).json(row);
});

adminInvoicesRouter.patch("/:id", async (req, res) => {
  const { status, amount, dueDate, memo, poNumber, terms } = req.body ?? {};
  if (status && !INVOICE_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const [row] = await db
    .update(invoices)
    .set({
      ...(status ? { status, ...(status === "paid" ? { paidAt: new Date() } : {}) } : {}),
      ...(amount !== undefined ? { amount: Number(amount) } : {}),
      ...(dueDate !== undefined ? { dueDate: dueDate ? new Date(dueDate) : null } : {}),
      ...(memo !== undefined ? { memo } : {}),
      ...(poNumber !== undefined ? { poNumber } : {}),
      ...(terms !== undefined ? { terms } : {}),
    })
    .where(eq(invoices.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Invoice not found" });
  res.json(row);
});

/**
 * Records one payment across one or more invoices (Signet lets a buyer tick
 * several open invoices and settle them in a single transaction). Partial
 * amounts are allowed; the net total must be positive.
 */
adminInvoicesRouter.post("/payments/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const { allocations, method, reference, memo, surcharge } = req.body ?? {};
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return res.status(400).json({ error: "allocations[] of { invoiceId, amount } is required" });
  }

  const ids = allocations.map((a: { invoiceId: string }) => a.invoiceId);
  const targets = await db.query.invoices.findMany({ where: inArray(invoices.id, ids) });
  if (targets.length !== ids.length) return res.status(404).json({ error: "One or more invoices not found" });
  if (targets.some((t) => t.tenantId !== tenant.id)) {
    return res.status(403).json({ error: "Invoice does not belong to this client" });
  }

  const blocked = targets.find((t) => !isPayable(t));
  if (blocked) return res.status(409).json({ error: `Invoice ${blocked.invoiceNumber} is not payable` });

  let total = 0;
  for (const alloc of allocations) {
    const invoice = targets.find((t) => t.id === alloc.invoiceId)!;
    const amount = Number(alloc.amount);
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: "Allocation amounts must be > 0" });
    if (amount > round(invoice.amount - invoice.amountPaid) + 0.005) {
      return res.status(400).json({ error: `Allocation exceeds balance on ${invoice.invoiceNumber}` });
    }
    total += amount;
  }
  if (round(total) <= 0) return res.status(400).json({ error: "Payment total must be positive" });

  const [batch] = await db
    .insert(paymentBatches)
    .values({
      tenantId: tenant.id,
      amount: round(total),
      surcharge: Number(surcharge) || 0,
      method: method || "card-token",
      status: "settled",
      reference: reference || null,
      memo: memo || null,
      settledAt: new Date(),
    })
    .returning();

  for (const alloc of allocations) {
    const invoice = targets.find((t) => t.id === alloc.invoiceId)!;
    const amount = round(Number(alloc.amount));
    await db.insert(invoicePayments).values({
      invoiceId: invoice.id,
      batchId: batch.id,
      amount,
      method: batch.method,
      status: "settled",
      reference: batch.reference,
      memo: batch.memo,
    });

    const amountPaid = round(invoice.amountPaid + amount);
    const status = derivedStatus(invoice.amount, amountPaid, invoice.dueDate);
    await db
      .update(invoices)
      .set({
        amountPaid,
        status,
        ...(status === "paid" ? { paidAt: new Date() } : {}),
        // Only an unsettled receipt holds the invoice; settled ones stay payable
        // so a buyer can clear the remaining balance immediately.
        lockedUntil: batch.status === "settled" ? null : new Date(Date.now() + 4 * 86_400_000),
      })
      .where(eq(invoices.id, invoice.id));
  }

  res.status(201).json({ batch, appliedTo: ids.length });
});

adminInvoicesRouter.get("/payments/batches/all", async (_req, res) => {
  const rows = await db.query.paymentBatches.findMany({
    orderBy: desc(paymentBatches.createdAt),
    with: { tenant: true, payments: true },
  });
  res.json(rows);
});

/** Releases the post-payment hold early once staff confirm the ERP posting. */
adminInvoicesRouter.post("/:id/unlock", async (req, res) => {
  const email = await staffEmail(req);
  const [row] = await db
    .update(invoices)
    .set({ lockedUntil: null, memo: email ? `Unlocked by ${email}` : null })
    .where(eq(invoices.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Invoice not found" });
  res.json(row);
});

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
