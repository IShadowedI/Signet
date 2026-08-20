import { Router } from "express";
import { asc, eq, isNull, or } from "drizzle-orm";
import { db } from "../../db";
import { sitePages, siteTemplates, tenants } from "../../schema";
import { internalTenantId, requireInternalAuth } from "../../auth";
import { staffEmail } from "./helpers";

export const adminSitesRouter = Router();
adminSitesRouter.use(requireInternalAuth());

/**
 * "Ongoing sites" workspace: every client storefront with its page count and
 * which template it was built from, so several people can work across sites
 * without stepping on each other.
 */
adminSitesRouter.get("/", async (req, res) => {
  const scopedTenantId = internalTenantId(req);
  const rows = await db.query.tenants.findMany({
    where: scopedTenantId ? or(eq(tenants.id, scopedTenantId), eq(tenants.parentTenantId, scopedTenantId)) : isNull(tenants.parentTenantId),
    orderBy: asc(tenants.name),
  });
  const pages = await db.query.sitePages.findMany({ with: { template: true } });

  res.json(
    rows.map((t) => {
      const own = pages.filter((p) => p.tenantId === t.id);
      const lastEdit = own.reduce<Date | null>((latest, p) => (!latest || p.updatedAt > latest ? p.updatedAt : latest), null);
      const templateNames = [...new Set(own.map((p) => p.template?.name).filter(Boolean))];
      return {
        slug: t.slug,
        name: t.name,
        domain: t.domain,
        logoUrl: t.logoUrl,
        primaryColor: t.primaryColor,
        pageCount: own.length,
        publishedCount: own.filter((p) => p.isPublished).length,
        hasHome: own.some((p) => p.isHome),
        templates: templateNames,
        lastEditedAt: lastEdit,
        lastEditedBy: own.find((p) => p.updatedAt === lastEdit)?.updatedByEmail ?? null,
      };
    }),
  );
});

adminSitesRouter.get("/:slug/pages", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });
  const scopedTenantId = internalTenantId(req);
  if (scopedTenantId && tenant.id !== scopedTenantId && tenant.parentTenantId !== scopedTenantId) return res.status(403).json({ error: "Forbidden" });
  const rows = await db.query.sitePages.findMany({
    where: eq(sitePages.tenantId, tenant.id),
    orderBy: [asc(sitePages.sortOrder), asc(sitePages.path)],
    with: { template: true },
  });
  res.json(rows);
});

adminSitesRouter.post("/:slug/pages", async (req, res) => {
  const tenant = await db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const { path: rawPath, title, html, css, js, isHome, templateId } = req.body ?? {};
  if (!rawPath || !title) return res.status(400).json({ error: "path and title are required" });

  const pagePath = normalizePath(rawPath);
  const clash = await db.query.sitePages.findFirst({ where: eq(sitePages.tenantId, tenant.id) });
  if (clash && (await pathTaken(tenant.id, pagePath))) {
    return res.status(409).json({ error: `A page already exists at ${pagePath}` });
  }

  // Seed from a gallery template when one is chosen, otherwise start blank.
  let seedHtml = html ?? "";
  let seedCss = css ?? "";
  if (templateId) {
    const template = await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.id, templateId) });
    if (template) {
      seedHtml = html ?? template.html;
      seedCss = css ?? template.css;
    }
  }

  const [row] = await db
    .insert(sitePages)
    .values({
      tenantId: tenant.id,
      path: pagePath,
      title,
      html: seedHtml,
      css: seedCss,
      js: js ?? "",
      isHome: Boolean(isHome),
      templateId: templateId || null,
      updatedByEmail: await staffEmail(req),
    })
    .returning();

  if (row.isHome) await clearOtherHomes(tenant.id, row.id);
  res.status(201).json(row);
});

adminSitesRouter.get("/:slug/pages/:pageId", async (req, res) => {
  const row = await db.query.sitePages.findFirst({
    where: eq(sitePages.id, req.params.pageId),
    with: { template: true },
  });
  if (!row) return res.status(404).json({ error: "Page not found" });
  res.json(row);
});

adminSitesRouter.patch("/:slug/pages/:pageId", async (req, res) => {
  const { title, html, css, js, isHome, isPublished, sortOrder, seoDescription, path: rawPath } = req.body ?? {};
  const existing = await db.query.sitePages.findFirst({ where: eq(sitePages.id, req.params.pageId) });
  if (!existing) return res.status(404).json({ error: "Page not found" });

  const pagePath = rawPath !== undefined ? normalizePath(rawPath) : undefined;
  if (pagePath && pagePath !== existing.path && (await pathTaken(existing.tenantId, pagePath))) {
    return res.status(409).json({ error: `A page already exists at ${pagePath}` });
  }

  const [row] = await db
    .update(sitePages)
    .set({
      ...(title !== undefined ? { title } : {}),
      ...(pagePath !== undefined ? { path: pagePath } : {}),
      ...(html !== undefined ? { html } : {}),
      ...(css !== undefined ? { css } : {}),
      ...(js !== undefined ? { js } : {}),
      ...(isHome !== undefined ? { isHome: Boolean(isHome) } : {}),
      ...(isPublished !== undefined ? { isPublished: Boolean(isPublished) } : {}),
      ...(sortOrder !== undefined ? { sortOrder: Number(sortOrder) } : {}),
      ...(seoDescription !== undefined ? { seoDescription } : {}),
      updatedByEmail: await staffEmail(req),
      updatedAt: new Date(),
    })
    .where(eq(sitePages.id, req.params.pageId))
    .returning();

  if (row.isHome) await clearOtherHomes(row.tenantId, row.id);
  res.json(row);
});

adminSitesRouter.post("/:slug/pages/:pageId/duplicate", async (req, res) => {
  const source = await db.query.sitePages.findFirst({ where: eq(sitePages.id, req.params.pageId) });
  if (!source) return res.status(404).json({ error: "Page not found" });

  let candidate = `${source.path === "/" ? "/home" : source.path}-copy`;
  let n = 2;
  while (await pathTaken(source.tenantId, candidate)) candidate = `${source.path}-copy-${n++}`;

  const [row] = await db
    .insert(sitePages)
    .values({
      tenantId: source.tenantId,
      path: candidate,
      title: `${source.title} (copy)`,
      html: source.html,
      css: source.css,
      js: source.js,
      isHome: false,
      templateId: source.templateId,
      updatedByEmail: await staffEmail(req),
    })
    .returning();
  res.status(201).json(row);
});

adminSitesRouter.delete("/:slug/pages/:pageId", async (req, res) => {
  await db.delete(sitePages).where(eq(sitePages.id, req.params.pageId));
  res.status(204).end();
});

/** Standalone render of a page, used by the admin preview iframe. */
adminSitesRouter.get("/:slug/pages/:pageId/preview", async (req, res) => {
  const page = await db.query.sitePages.findFirst({ where: eq(sitePages.id, req.params.pageId) });
  if (!page) return res.status(404).json({ error: "Page not found" });

  const hasDocument = /<html[\s>]/i.test(page.html);
  const body = hasDocument
    ? page.html.replace(/<\/head>/i, `<style>${page.css}</style></head>`)
    : `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(page.title)}</title>` +
      `<style>${page.css}</style></head><body>${page.html}</body></html>`;

  res.type("html").send(page.js ? body.replace(/<\/body>/i, `<script>${page.js}</script></body>`) : body);
});

async function pathTaken(tenantId: string, pagePath: string): Promise<boolean> {
  const rows = await db.query.sitePages.findMany({ where: eq(sitePages.tenantId, tenantId) });
  return rows.some((r) => r.path === pagePath);
}

/** Only one page per site can be the homepage. */
async function clearOtherHomes(tenantId: string, keepId: string) {
  const rows = await db.query.sitePages.findMany({ where: eq(sitePages.tenantId, tenantId) });
  for (const row of rows) {
    if (row.id !== keepId && row.isHome) {
      await db.update(sitePages).set({ isHome: false }).where(eq(sitePages.id, row.id));
    }
  }
}

function normalizePath(value: string): string {
  const trimmed = String(value).trim().toLowerCase();
  const withSlash = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, "") : "/";
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}
