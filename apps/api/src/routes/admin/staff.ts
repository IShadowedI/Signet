import { Router } from "express";
import { asc, desc, eq } from "drizzle-orm";
import { hashPassword, requireInternalAuth } from "../../auth";
import { db } from "../../db";
import { internalUsers, orders, tenants } from "../../schema";

export const adminStaffRouter = Router();
adminStaffRouter.use(requireInternalAuth("owner"));

/** Owner-only account registry across all client companies. */
adminStaffRouter.get("/", async (_req, res) => {
  const rows = await db.query.internalUsers.findMany({ orderBy: asc(internalUsers.name), with: { tenant: true } });
  res.json(rows.map((user) => ({ id: user.id, username: user.username, name: user.name, role: user.role, tenant: user.tenant })));
});

adminStaffRouter.post("/", async (req, res) => {
  const { username, password, name, role, tenantSlug } = req.body ?? {};
  if (!username || !password || !name || !["admin", "employee"].includes(role)) {
    return res.status(400).json({ error: "username, password, name, and an admin or employee role are required" });
  }
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, tenantSlug ?? "") });
  if (!tenant) return res.status(400).json({ error: "Select a company" });

  const normalized = String(username).trim().toLowerCase();
  const [user] = await db
    .insert(internalUsers)
    .values({
      username: normalized,
      email: `${normalized}@${tenant.slug}.internal`,
      passwordHash: await hashPassword(String(password)),
      name: String(name),
      role,
      tenantId: tenant.id,
    })
    .returning();
  res.status(201).json({ id: user.id, username: user.username, name: user.name, role: user.role, tenant: { slug: tenant.slug, name: tenant.name } });
});

/** Lightweight alert feed: most-recent orders are the interaction log for now. */
adminStaffRouter.get("/activity", async (_req, res) => {
  const rows = await db.query.orders.findMany({ orderBy: desc(orders.createdAt), limit: 8, with: { tenant: true, user: true } });
  res.json(rows.map((order) => ({ id: order.id, type: "order", status: order.status, createdAt: order.createdAt, tenant: order.tenant.name, user: order.user?.name ?? "Guest" })));
});
