import { Router } from "express";
import path from "node:path";
import { eq, or } from "drizzle-orm";
import { appendOrderToCsv } from "@signet/erp";
import { db } from "../db";
import {
  allotmentTransactions,
  credentialRequests,
  orderLines,
  orders,
  pageViews,
  productInteractions,
  savedSearches,
  searchLogs,
  sitePages,
  tenants,
  users,
} from "../schema";
import { erp } from "../erp";
import { BUYER_COOKIE } from "../auth";
import jwt from "jsonwebtoken";

export const storefrontRouter = Router();

/**
 * Public storefront payload for a tenant: branding + the tenant's catalog with
 * customer-specific pricing already applied. This is what the Next.js
 * storefront renders.
 */
storefrontRouter.get("/:slug", async (req, res) => {
  const { slug } = req.params;

  const tenant = await db.query.tenants.findFirst({
    where: or(eq(tenants.slug, slug), eq(tenants.domain, slug)),
    with: {
      catalog: { with: { product: { with: { variants: true } } } },
    },
  });

  if (!tenant) {
    return res.status(404).json({ error: `Unknown storefront "${slug}"` });
  }

  const products = tenant.catalog.map((tp) => {
    const variants = tp.product.variants.map((v) => ({
      sku: v.sku,
      size: v.size,
      color: v.color,
      price: tp.priceOverride ?? v.price, // customer-specific pricing
      available: v.available,
    }));
    const fromPrice = variants.reduce(
      (min, v) => Math.min(min, v.price),
      Number.POSITIVE_INFINITY,
    );
    return {
      id: tp.product.id,
      sku: tp.product.sku,
      name: tp.product.name,
      description: tp.product.description,
      brand: tp.product.brand,
      imageUrl: tp.product.imageUrl,
      allotmentEligible: tp.allotmentEligible,
      fromPrice: Number.isFinite(fromPrice) ? fromPrice : 0,
      variants,
    };
  });

  res.json({
    tenant: {
      slug: tenant.slug,
      name: tenant.name,
      primaryColor: tenant.primaryColor,
      accentColor: tenant.accentColor,
      logoUrl: tenant.logoUrl,
      heroHeadline: tenant.heroHeadline,
      heroSubtext: tenant.heroSubtext,
      pageBlocks: tenant.pageBlocks,
      punchoutEnabled: tenant.punchoutEnabled,
    },
    products,
  });
});

/** Public page payload for the editable site builder, published at /store/:slug/... . */
storefrontRouter.get("/:slug/page", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({
    where: or(eq(tenants.slug, req.params.slug), eq(tenants.domain, req.params.slug)),
  });
  if (!tenant) return res.status(404).json({ error: `Unknown storefront "${req.params.slug}"` });

  const requestedPath = normalizeSitePath(String(req.query.path ?? "/"));
  const page = await db.query.sitePages.findFirst({
    where: (pages, { and }) => and(eq(pages.tenantId, tenant.id), eq(pages.path, requestedPath), eq(pages.isPublished, true)),
  });
  if (!page) return res.status(404).json({ error: "Published page not found" });

  res.json({
    tenant: { slug: tenant.slug, name: tenant.name, primaryColor: tenant.primaryColor, accentColor: tenant.accentColor },
    page,
  });
});

function normalizeSitePath(value: string): string {
  const trimmed = value.trim().toLowerCase();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

/** Best-effort buyer identity from the session cookie, if present. */
function currentBuyerId(req: import("express").Request): string | null {
  const token = req.cookies?.[BUYER_COOKIE];
  if (!token) return null;
  try {
    const payload = jwt.verify(token, process.env.AUTH_JWT_SECRET ?? "dev-only-secret-change-in-production") as any;
    return payload?.scope === "buyer" ? payload.userId : null;
  } catch {
    return null;
  }
}

/**
 * Places an order for a tenant: validates payment method (PO/net-terms or
 * uniform allotment), persists it, submits to the ERP, and records the ERP
 * order id / status.
 */
storefrontRouter.post("/:slug/orders", async (req, res) => {
  const { slug } = req.params;
  const { lines, poNumber, userEmail, paymentMethod } = req.body ?? {};

  if (!Array.isArray(lines) || lines.length === 0) {
    return res.status(400).json({ error: "lines[] is required" });
  }

  const tenant = await db.query.tenants.findFirst({ where: or(eq(tenants.slug, slug), eq(tenants.domain, slug)) });
  if (!tenant) return res.status(404).json({ error: `Unknown storefront "${slug}"` });

  const buyerId = currentBuyerId(req);
  const user = buyerId
    ? await db.query.users.findFirst({ where: eq(users.id, buyerId) })
    : userEmail
      ? await db.query.users.findFirst({
          where: (u, { and }) => and(eq(u.tenantId, tenant.id), eq(u.email, userEmail)),
        })
      : null;

  const method = paymentMethod === "allotment" ? "allotment" : "po";
  const orderTotal = lines.reduce(
    (sum: number, l: { quantity: number; unitPrice?: number }) => sum + l.quantity * (l.unitPrice ?? 0),
    0,
  );

  if (method === "allotment") {
    if (!user) return res.status(401).json({ error: "Sign in required to pay with your uniform allotment" });
    if (user.allotmentBalance < orderTotal) {
      return res.status(402).json({ error: "Insufficient allotment balance", balance: user.allotmentBalance, orderTotal });
    }
  }

  // Employee enablement: large orders from plain buyers (not approvers/admins)
  // can require an approver's sign-off before they reach the ERP.
  const needsApproval = Boolean(
    tenant.requireApproval && orderTotal >= tenant.approvalThreshold && user && user.role === "buyer",
  );

  const [order] = await db
    .insert(orders)
    .values({
      tenantId: tenant.id,
      userId: user?.id,
      poNumber,
      status: needsApproval ? "pending_approval" : "pending",
      paymentMethod: method,
    })
    .returning();

  const createdLines = await db
    .insert(orderLines)
    .values(
      lines.map((l: { variantSku: string; quantity: number; unitPrice?: number }) => ({
        orderId: order.id,
        variantSku: l.variantSku,
        quantity: l.quantity,
        unitPrice: l.unitPrice ?? 0,
      })),
    )
    .returning();

  if (method === "allotment" && user) {
    await db.update(users).set({ allotmentBalance: user.allotmentBalance - orderTotal }).where(eq(users.id, user.id));
    await db.insert(allotmentTransactions).values({
      tenantId: tenant.id,
      userId: user.id,
      amount: -orderTotal,
      reason: `Order ${order.id}`,
      orderId: order.id,
    });
  }

  function syncCsv(finalOrder: { erpOrderId: string | null; status: string; createdAt: Date }) {
    // Re-bound here because narrowing from the earlier guard is lost inside a closure.
    const orderTenant = tenant!;
    appendOrderToCsv(
      path.join(process.cwd(), "exports", "orders.csv"),
      createdLines.map((l) => ({
        orderId: order.id,
        createdAt: finalOrder.createdAt.toISOString(),
        tenantSlug: orderTenant.slug,
        customerCode: orderTenant.erpCustomerCode ?? orderTenant.slug,
        poNumber,
        paymentMethod: method,
        sku: l.variantSku,
        quantity: l.quantity,
        unitPrice: l.unitPrice,
        erpOrderId: finalOrder.erpOrderId,
        status: finalOrder.status,
      })),
    );
  }

  if (needsApproval) {
    // Universal CSV sync still records the order immediately; ERP submission
    // waits for POST /api/account/:slug/orders/:id/approve.
    syncCsv(order);
    return res.status(201).json(order);
  }

  try {
    const result = await erp.submitOrder({
      customerCode: tenant.erpCustomerCode ?? tenant.slug,
      poNumber,
      lines: createdLines.map((l) => ({ sku: l.variantSku, quantity: l.quantity })),
    });
    const [updated] = await db
      .update(orders)
      .set({ status: "submitted", erpOrderId: result.erpOrderId })
      .where(eq(orders.id, order.id))
      .returning();
    syncCsv(updated);
    res.status(201).json(updated);
  } catch {
    const [updated] = await db.update(orders).set({ status: "error" }).where(eq(orders.id, order.id)).returning();
    syncCsv(updated);
    res.status(502).json({ error: "ERP submission failed", orderId: order.id });
  }
});

/**
 * Basic keyword search across a tenant's catalog (advanced-enterprise-search
 * lite): matches name/description/brand/sku, case-insensitively. Every query
 * is logged to searchLogs to power the admin CRM tab.
 */
storefrontRouter.get("/:slug/search", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({
    where: or(eq(tenants.slug, req.params.slug), eq(tenants.domain, req.params.slug)),
  });
  if (!tenant) return res.status(404).json({ error: `Unknown storefront "${req.params.slug}"` });

  const q = String(req.query.q ?? "").trim();
  if (!q) return res.json({ products: [] });

  const buyerId = currentBuyerId(req);
  await db.insert(searchLogs).values({ tenantId: tenant.id, userId: buyerId, query: q });

  const withCatalog = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenant.id),
    with: { catalog: { with: { product: { with: { variants: true } } } } },
  });

  const needle = q.toLowerCase();
  const matches = (withCatalog?.catalog ?? []).filter(
    (tp) =>
      tp.product.name.toLowerCase().includes(needle) ||
      tp.product.sku.toLowerCase().includes(needle) ||
      (tp.product.brand ?? "").toLowerCase().includes(needle) ||
      (tp.product.description ?? "").toLowerCase().includes(needle),
  );

  res.json({
    products: matches.map((tp) => ({
      id: tp.product.id,
      sku: tp.product.sku,
      name: tp.product.name,
      brand: tp.product.brand,
      imageUrl: tp.product.imageUrl,
      allotmentEligible: tp.allotmentEligible,
      fromPrice: Math.min(...tp.product.variants.map((v) => tp.priceOverride ?? v.price)),
    })),
  });
});

/**
 * Lightweight activity tracking that feeds the admin CRM tabs (website
 * visits, product interactions, keyword searches).
 */
storefrontRouter.post("/:slug/track", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({
    where: or(eq(tenants.slug, req.params.slug), eq(tenants.domain, req.params.slug)),
  });
  if (!tenant) return res.status(404).json({ error: `Unknown storefront "${req.params.slug}"` });

  const buyerId = currentBuyerId(req);
  const { type, path, productId, query } = req.body ?? {};

  switch (type) {
    case "page_view":
      await db.insert(pageViews).values({ tenantId: tenant.id, userId: buyerId, path: path ?? "/" });
      break;
    case "product_view":
    case "add_to_cart":
    case "purchase":
      await db.insert(productInteractions).values({ tenantId: tenant.id, userId: buyerId, productId, type });
      break;
    case "search":
      await db.insert(searchLogs).values({ tenantId: tenant.id, userId: buyerId, query: query ?? "" });
      break;
    default:
      return res.status(400).json({ error: "Unknown track type" });
  }
  res.status(204).end();
});

/** Buyer saves a search for later (Signet "saved searches" tab). */
storefrontRouter.post("/:slug/saved-searches", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Unknown storefront" });
  const buyerId = currentBuyerId(req);
  const { query } = req.body ?? {};
  if (!query) return res.status(400).json({ error: "query is required" });
  const [row] = await db.insert(savedSearches).values({ tenantId: tenant.id, userId: buyerId, query }).returning();
  res.status(201).json(row);
});

/** Buyer requests help with their username/password (Signet "UN/PW requests"). */
storefrontRouter.post("/:slug/credential-requests", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Unknown storefront" });
  const { email, type } = req.body ?? {};
  if (!email || !["username", "password"].includes(type)) {
    return res.status(400).json({ error: "email and type ('username'|'password') are required" });
  }
  const [row] = await db.insert(credentialRequests).values({ tenantId: tenant.id, email, type }).returning();
  res.status(201).json(row);
});
