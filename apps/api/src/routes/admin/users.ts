import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import { allotmentTransactions, tenants, users } from "../../schema";
import { hashPassword, requireInternalAuth } from "../../auth";

export const adminUsersRouter = Router();
adminUsersRouter.use(requireInternalAuth());

/** Lists a tenant's buyers with their current allotment balance. */
adminUsersRouter.get("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const rows = await db.query.users.findMany({ where: eq(users.tenantId, tenant.id) });
  res.json(rows.map(({ passwordHash, ...u }) => u));
});

/** Creates a buyer/approver account for a tenant. */
adminUsersRouter.post("/:slug", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const { email, name, role, password, allotmentBalance } = req.body ?? {};
  if (!email || !name) return res.status(400).json({ error: "email and name are required" });

  const [user] = await db
    .insert(users)
    .values({
      tenantId: tenant.id,
      email,
      name,
      role: role || "buyer",
      passwordHash: password ? await hashPassword(password) : null,
      allotmentBalance: Number(allotmentBalance ?? 0),
    })
    .returning();
  const { passwordHash, ...safe } = user;
  res.status(201).json(safe);
});

/**
 * Adjusts a buyer's uniform-allotment balance and records the change in the
 * ledger (allotment_transactions) so every grant/spend is auditable.
 */
adminUsersRouter.post("/:slug/:userId/allotment", async (req, res) => {
  const { amount, reason } = req.body ?? {};
  if (typeof amount !== "number" || amount === 0) {
    return res.status(400).json({ error: "amount (nonzero number) is required" });
  }

  const user = await db.query.users.findFirst({ where: eq(users.id, req.params.userId) });
  if (!user) return res.status(404).json({ error: "User not found" });

  const [updated] = await db
    .update(users)
    .set({ allotmentBalance: user.allotmentBalance + amount })
    .where(eq(users.id, user.id))
    .returning();

  await db.insert(allotmentTransactions).values({
    tenantId: user.tenantId,
    userId: user.id,
    amount,
    reason: reason || (amount > 0 ? "Manual grant" : "Manual adjustment"),
  });

  const { passwordHash, ...safe } = updated;
  res.json(safe);
});

/** Full allotment ledger for a buyer (audit trail). */
adminUsersRouter.get("/:slug/:userId/allotment/ledger", async (req, res) => {
  const rows = await db.query.allotmentTransactions.findMany({
    where: eq(allotmentTransactions.userId, req.params.userId),
    orderBy: desc(allotmentTransactions.createdAt),
  });
  res.json(rows);
});
