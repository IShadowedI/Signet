import { Router } from "express";
import { eq, or } from "drizzle-orm";
import { db } from "../db";
import { internalUsers, tenants, users } from "../schema";
import {
  BUYER_COOKIE,
  clearSessionCookie,
  INTERNAL_COOKIE,
  requireBuyerAuth,
  requireInternalAuth,
  setSessionCookie,
  signToken,
  verifyPassword,
} from "../auth";

export const authRouter = Router();

// ---- Signet staff (admin app) ----

authRouter.post("/internal/login", async (req, res) => {
  const { username, email, password } = req.body ?? {};
  const identity = String(username ?? email ?? "").trim().toLowerCase();
  const user = await db.query.internalUsers.findFirst({
    where: or(eq(internalUsers.username, identity), eq(internalUsers.email, identity)),
    with: { tenant: true },
  });
  if (!user || !(await verifyPassword(password ?? "", user.passwordHash))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  const token = signToken({ scope: "internal", userId: user.id, role: user.role, tenantId: user.tenantId });
  setSessionCookie(res, INTERNAL_COOKIE, token);
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, tenant: user.tenant });
});

/** Staff use this separate endpoint after choosing their client company. */
authRouter.post("/internal/staff-login", async (req, res) => {
  const { username, password, companySlug } = req.body ?? {};
  const user = await db.query.internalUsers.findFirst({
    where: eq(internalUsers.username, String(username ?? "").trim().toLowerCase()),
    with: { tenant: true },
  });
  if (!user || !(await verifyPassword(password ?? "", user.passwordHash))) {
    return res.status(401).json({ error: "Invalid username or password" });
  }
  if (user.role !== "owner" && (!user.tenant || user.tenant.slug !== companySlug)) {
    return res.status(403).json({ error: "This account is not assigned to the selected company" });
  }
  const token = signToken({ scope: "internal", userId: user.id, role: user.role, tenantId: user.tenantId });
  setSessionCookie(res, INTERNAL_COOKIE, token);
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, tenant: user.tenant });
});

/** Company selector for the staff login, intentionally limited to safe display fields. */
authRouter.get("/internal/companies", async (_req, res) => {
  const rows = await db.query.tenants.findMany({ orderBy: (t, { asc }) => asc(t.name) });
  res.json(rows.map((tenant) => ({ slug: tenant.slug, name: tenant.name })));
});

authRouter.post("/internal/logout", (_req, res) => {
  clearSessionCookie(res, INTERNAL_COOKIE);
  res.json({ ok: true });
});

authRouter.get("/internal/me", requireInternalAuth(), async (req, res) => {
  const user = await db.query.internalUsers.findFirst({ where: eq(internalUsers.id, req.internalUser!.userId), with: { tenant: true } });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, username: user.username, name: user.name, role: user.role, tenant: user.tenant });
});

// ---- Storefront buyers (per-tenant) ----

authRouter.post("/storefront/:slug/login", async (req, res) => {
  const { slug } = req.params;
  const { email, password } = req.body ?? {};

  const tenant = await db.query.tenants.findFirst({ where: or(eq(tenants.slug, slug), eq(tenants.domain, slug)) });
  if (!tenant) return res.status(404).json({ error: `Unknown storefront "${slug}"` });

  const user = await db.query.users.findFirst({
    where: (u, { and }) => and(eq(u.tenantId, tenant.id), eq(u.email, email ?? "")),
  });
  if (!user || !user.passwordHash || !(await verifyPassword(password ?? "", user.passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  const token = signToken({ scope: "buyer", userId: user.id, tenantId: tenant.id, role: user.role });
  setSessionCookie(res, BUYER_COOKIE, token);
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, allotmentBalance: user.allotmentBalance });
});

authRouter.post("/storefront/:slug/logout", (_req, res) => {
  clearSessionCookie(res, BUYER_COOKIE);
  res.json({ ok: true });
});

authRouter.get("/storefront/:slug/me", requireBuyerAuth, async (req, res) => {
  const user = await db.query.users.findFirst({ where: eq(users.id, req.buyerUser!.userId) });
  if (!user) return res.status(404).json({ error: "Not found" });
  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, allotmentBalance: user.allotmentBalance });
});
