import { Router } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../../db";
import {
  addresses,
  contacts,
  credentialRequests,
  pageViews,
  paymentMethods,
  productInteractions,
  savedSearches,
  searchLogs,
  tenants,
} from "../../schema";
import { requireInternalAuth } from "../../auth";

export const adminCrmRouter = Router();
adminCrmRouter.use(requireInternalAuth());

async function tenantOr404(slug: string, res: import("express").Response) {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, slug) });
  if (!tenant) {
    res.status(404).json({ error: "Tenant not found" });
    return null;
  }
  return tenant;
}

/**
 * The full Signet-style customer workspace for one tenant: contacts,
 * addresses, saved searches, credit-card references, UN/PW requests, and
 * activity (search logs, product interactions, page views).
 */
adminCrmRouter.get("/:slug", async (req, res) => {
  const tenant = await tenantOr404(req.params.slug, res);
  if (!tenant) return;

  const [
    contactRows,
    addressRows,
    cardRows,
    searchRows,
    credRows,
    searchLogRows,
    interactionRows,
    viewRows,
  ] = await Promise.all([
    db.query.contacts.findMany({ where: eq(contacts.tenantId, tenant.id), orderBy: desc(contacts.createdAt) }),
    db.query.addresses.findMany({ where: eq(addresses.tenantId, tenant.id) }),
    db.query.paymentMethods.findMany({ where: eq(paymentMethods.tenantId, tenant.id) }),
    db.query.savedSearches.findMany({ where: eq(savedSearches.tenantId, tenant.id), orderBy: desc(savedSearches.createdAt) }),
    db.query.credentialRequests.findMany({ where: eq(credentialRequests.tenantId, tenant.id), orderBy: desc(credentialRequests.createdAt) }),
    db.query.searchLogs.findMany({ where: eq(searchLogs.tenantId, tenant.id), orderBy: desc(searchLogs.createdAt), limit: 200 }),
    db.query.productInteractions.findMany({ where: eq(productInteractions.tenantId, tenant.id), orderBy: desc(productInteractions.createdAt), limit: 200 }),
    db.query.pageViews.findMany({ where: eq(pageViews.tenantId, tenant.id), orderBy: desc(pageViews.createdAt), limit: 200 }),
  ]);

  res.json({
    contacts: contactRows,
    addresses: addressRows,
    paymentMethods: cardRows,
    savedSearches: searchRows,
    credentialRequests: credRows,
    searchLogs: searchLogRows,
    productInteractions: interactionRows,
    pageViews: viewRows,
  });
});

adminCrmRouter.post("/:slug/contacts", async (req, res) => {
  const tenant = await tenantOr404(req.params.slug, res);
  if (!tenant) return;
  const { name, email, phone, title, userId } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });
  const [row] = await db.insert(contacts).values({ tenantId: tenant.id, name, email, phone, title, userId }).returning();
  res.status(201).json(row);
});

adminCrmRouter.post("/:slug/addresses", async (req, res) => {
  const tenant = await tenantOr404(req.params.slug, res);
  if (!tenant) return;
  const { label, line1, line2, city, state, postalCode, country, isDefault, userId } = req.body ?? {};
  if (!line1 || !city || !state || !postalCode) {
    return res.status(400).json({ error: "line1, city, state, postalCode are required" });
  }
  const [row] = await db
    .insert(addresses)
    .values({ tenantId: tenant.id, label, line1, line2, city, state, postalCode, country, isDefault, userId })
    .returning();
  res.status(201).json(row);
});

/** Resolves a UN/PW access request (marks it handled by staff). */
adminCrmRouter.post("/:slug/credential-requests/:id/resolve", async (req, res) => {
  const [row] = await db
    .update(credentialRequests)
    .set({ status: "resolved" })
    .where(eq(credentialRequests.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json(row);
});
