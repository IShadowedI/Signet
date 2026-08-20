import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { adhocRequests, returnActions, returnReasons, returnStages, returns } from "../../schema";
import { internalTenantId, requireInternalAuth } from "../../auth";
import { documentNumber, ensureReturnConfig, staffEmail } from "./helpers";

export const adminReturnsRouter = Router();
adminReturnsRouter.use(requireInternalAuth());

/**
 * RMA workflow. Approval is a hard gate (requested -> approved/rejected ->
 * completed) while `stage` is a soft, admin-configurable pipeline position, so
 * ops can add stages like "In Transit" or "Received" without a code change.
 */
export const RETURN_STATUSES = ["requested", "approved", "rejected", "completed"] as const;
export const ADHOC_STATUSES = ["open", "in_progress", "waiting_on_customer", "resolved", "closed"] as const;
export const ADHOC_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

// ---- Configuration pick lists ----

adminReturnsRouter.get("/config", async (_req, res) => {
  await ensureReturnConfig();
  const [reasons, actions, stages] = await Promise.all([
    db.query.returnReasons.findMany({ orderBy: asc(returnReasons.sortOrder) }),
    db.query.returnActions.findMany({ orderBy: asc(returnActions.sortOrder) }),
    db.query.returnStages.findMany({ orderBy: asc(returnStages.sortOrder) }),
  ]);
  res.json({ reasons, actions, stages });
});

adminReturnsRouter.post("/config/reasons", async (req, res) => {
  const { label, sortOrder } = req.body ?? {};
  if (!label) return res.status(400).json({ error: "label is required" });
  const [row] = await db.insert(returnReasons).values({ label, sortOrder: Number(sortOrder) || 0 }).returning();
  res.status(201).json(row);
});

adminReturnsRouter.post("/config/actions", async (req, res) => {
  const { label, reasonIds, sortOrder } = req.body ?? {};
  if (!label) return res.status(400).json({ error: "label is required" });
  const [row] = await db
    .insert(returnActions)
    .values({ label, reasonIds: Array.isArray(reasonIds) ? reasonIds : [], sortOrder: Number(sortOrder) || 0 })
    .returning();
  res.status(201).json(row);
});

adminReturnsRouter.post("/config/stages", async (req, res) => {
  const { label, sortOrder, isTerminal } = req.body ?? {};
  if (!label) return res.status(400).json({ error: "label is required" });
  const [row] = await db
    .insert(returnStages)
    .values({ label, sortOrder: Number(sortOrder) || 0, isTerminal: Boolean(isTerminal) })
    .returning();
  res.status(201).json(row);
});

adminReturnsRouter.delete("/config/reasons/:id", async (req, res) => {
  await db.update(returnReasons).set({ active: false }).where(eq(returnReasons.id, req.params.id));
  res.status(204).end();
});

adminReturnsRouter.delete("/config/actions/:id", async (req, res) => {
  await db.update(returnActions).set({ active: false }).where(eq(returnActions.id, req.params.id));
  res.status(204).end();
});

adminReturnsRouter.delete("/config/stages/:id", async (req, res) => {
  await db.delete(returnStages).where(eq(returnStages.id, req.params.id));
  res.status(204).end();
});

// ---- Returns ----

adminReturnsRouter.get("/", async (req, res) => {
  const scopedTenantId = internalTenantId(req);
  const rows = await db.query.returns.findMany({
    ...(scopedTenantId ? { where: eq(returns.tenantId, scopedTenantId) } : {}),
    orderBy: desc(returns.createdAt),
    with: { tenant: true, user: true, order: true, lines: true },
  });
  res.json(rows);
});

adminReturnsRouter.patch("/:id", async (req, res) => {
  const { status, stage, carrier, trackingNumber, returnToAddress } = req.body ?? {};
  if (status && !RETURN_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const existing = await db.query.returns.findFirst({ where: eq(returns.id, req.params.id) });
  if (!existing) return res.status(404).json({ error: "Return not found" });

  const [row] = await db
    .update(returns)
    .set({
      ...(status ? { status } : {}),
      ...(stage !== undefined ? { stage } : {}),
      ...(carrier !== undefined ? { carrier } : {}),
      ...(trackingNumber !== undefined ? { trackingNumber } : {}),
      ...(returnToAddress !== undefined ? { returnToAddress } : {}),
      // An RMA number is only issued once the return is actually authorised.
      ...(status === "approved" && !existing.rmaNumber ? { rmaNumber: documentNumber("RMA") } : {}),
      ...(status === "approved" ? { approvedAt: new Date() } : {}),
    })
    .where(eq(returns.id, req.params.id))
    .returning();
  res.json(row);
});

// ---- Ad-hoc requests (Signet's customer request tracking) ----

adminReturnsRouter.get("/adhoc/all", async (req, res) => {
  const scopedTenantId = internalTenantId(req);
  const rows = await db.query.adhocRequests.findMany({
    ...(scopedTenantId ? { where: eq(adhocRequests.tenantId, scopedTenantId) } : {}),
    orderBy: desc(adhocRequests.createdAt),
    with: { tenant: true, user: true },
  });
  res.json(rows);
});

adminReturnsRouter.patch("/adhoc/:id", async (req, res) => {
  const { status, priority, assignedToEmail, details } = req.body ?? {};
  if (status && !ADHOC_STATUSES.includes(status)) return res.status(400).json({ error: "Invalid status" });
  if (priority && !ADHOC_PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority" });

  const [row] = await db
    .update(adhocRequests)
    .set({
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(details !== undefined ? { details } : {}),
      ...(assignedToEmail !== undefined ? { assignedToEmail } : {}),
      updatedAt: new Date(),
    })
    .where(eq(adhocRequests.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Request not found" });
  res.json(row);
});

/** Assigns the request to whoever is signed in — the common "I'll take this" action. */
adminReturnsRouter.post("/adhoc/:id/claim", async (req, res) => {
  const email = await staffEmail(req);
  const [row] = await db
    .update(adhocRequests)
    .set({ assignedToEmail: email, status: "in_progress", updatedAt: new Date() })
    .where(eq(adhocRequests.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Request not found" });
  res.json(row);
});
