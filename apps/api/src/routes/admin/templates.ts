import { Router } from "express";
import multer from "multer";
import path from "node:path";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { asc, desc, eq } from "drizzle-orm";
import {
  builtinTemplatesDir,
  directorySize,
  extractZipToDir,
  flattenPage,
  listBuiltinTemplates,
  listTemplateFiles,
  loadManifest,
  readTemplateFile,
  slugify,
  type TemplateManifest,
} from "@signet/site-templates";
import { db } from "../../db";
import { siteTemplatePages, siteTemplates, sitePages, tenants } from "../../schema";
import { requireInternalAuth } from "../../auth";
import { staffEmail } from "./helpers";

export const adminTemplatesRouter = Router();
adminTemplatesRouter.use(requireInternalAuth());

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

/** Uploaded themes live outside the repo; built-ins ship inside packages/site-templates. */
function uploadsRoot(): string {
  return path.join(process.cwd(), "storage", "templates");
}

function templateDir(template: { slug: string; sourceType: string }): string {
  return template.sourceType === "builtin"
    ? path.join(builtinTemplatesDir(), template.slug)
    : path.join(uploadsRoot(), template.slug);
}

async function replacePages(templateId: string, manifest: TemplateManifest) {
  await db.delete(siteTemplatePages).where(eq(siteTemplatePages.templateId, templateId));
  const pages = manifest.pages ?? [];
  if (pages.length === 0) return;
  await db.insert(siteTemplatePages).values(
    pages.map((p, i) => ({
      templateId,
      file: p.file,
      path: p.path,
      title: p.title,
      isHome: Boolean(p.isHome),
      sortOrder: i,
    })),
  );
}

/**
 * Registers (or refreshes) every template shipped in the repo. Runs on demand
 * and automatically the first time the gallery is opened, so a fresh clone
 * already has a usable starter gallery.
 */
export async function syncBuiltinTemplates(): Promise<number> {
  const found = listBuiltinTemplates();
  for (const { dir, manifest } of found) {
    const values = {
      slug: manifest.slug,
      name: manifest.name,
      description: manifest.description ?? null,
      category: manifest.category ?? "General",
      thumbnailUrl: manifest.thumbnail ?? null,
      tags: manifest.tags ?? [],
      sourceType: "builtin",
      entryFile: manifest.entry,
      fileCount: listTemplateFiles(dir).length,
      sizeBytes: directorySize(dir),
      updatedAt: new Date(),
    };

    const existing = await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.slug, manifest.slug) });
    const row = existing
      ? (await db.update(siteTemplates).set(values).where(eq(siteTemplates.id, existing.id)).returning())[0]
      : (await db.insert(siteTemplates).values(values).returning())[0];
    await replacePages(row.id, manifest);
  }
  return found.length;
}

adminTemplatesRouter.get("/", async (_req, res) => {
  await syncBuiltinTemplates();

  const rows = await db.query.siteTemplates.findMany({
    orderBy: [asc(siteTemplates.category), asc(siteTemplates.name)],
    with: { pages: { orderBy: asc(siteTemplatePages.sortOrder) } },
  });
  res.json(rows);
});

adminTemplatesRouter.post("/sync-builtins", async (_req, res) => {
  const count = await syncBuiltinTemplates();
  res.json({ synced: count });
});

adminTemplatesRouter.get("/:id", async (req, res) => {
  const template = await db.query.siteTemplates.findFirst({
    where: eq(siteTemplates.id, req.params.id),
    with: { pages: { orderBy: asc(siteTemplatePages.sortOrder) } },
  });
  if (!template) return res.status(404).json({ error: "Template not found" });

  const dir = templateDir(template);
  res.json({ ...template, files: existsSync(dir) ? listTemplateFiles(dir) : [] });
});

/**
 * Renders one template page as standalone HTML for the gallery preview iframe.
 * Served as a document, so it is sandboxed by the caller rather than executed
 * inside the admin app's own origin.
 */
adminTemplatesRouter.get("/:id/preview/:pageId", async (req, res) => {
  const template = await db.query.siteTemplates.findFirst({
    where: eq(siteTemplates.id, req.params.id),
    with: { pages: true },
  });
  if (!template) return res.status(404).json({ error: "Template not found" });

  const dir = templateDir(template);
  const page = template.pages.find((p) => p.id === req.params.pageId) ?? template.pages[0];

  if (!page || !existsSync(dir)) {
    return res
      .type("html")
      .send(`<!doctype html><meta charset="utf-8"><style>${template.css}</style>${template.html}`);
  }

  try {
    res.type("html").send(readTemplateFile(dir, page.file));
  } catch {
    res.status(404).json({ error: "Page file missing from template" });
  }
});

/** Raw file read, used by the "inspect template source" view. */
adminTemplatesRouter.get("/:id/file", async (req, res) => {
  const file = String(req.query.path ?? "");
  if (!file) return res.status(400).json({ error: "path query param is required" });

  const template = await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.id, req.params.id) });
  if (!template) return res.status(404).json({ error: "Template not found" });

  try {
    res.type("text/plain").send(readTemplateFile(templateDir(template), file));
  } catch {
    res.status(404).json({ error: "File not found in template" });
  }
});

/**
 * Import a theme: either a multi-file .zip of HTML/CSS/JS, or raw html/css
 * pasted straight into the form for a quick one-page starter.
 */
adminTemplatesRouter.post("/", upload.single("file"), async (req, res) => {
  const { name, description, category, thumbnailUrl, tags, html, css } = req.body ?? {};
  if (!name) return res.status(400).json({ error: "name is required" });

  const baseSlug = slugify(String(name));
  const existing = await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.slug, baseSlug) });
  const slug = existing ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

  const parsedTags = typeof tags === "string" ? tags.split(",").map((t) => t.trim()).filter(Boolean) : tags ?? [];
  const email = await staffEmail(req);

  if (!req.file) {
    if (!html) return res.status(400).json({ error: "Provide either a .zip file or html content" });
    const [row] = await db
      .insert(siteTemplates)
      .values({
        slug,
        name,
        description: description || null,
        category: category || "General",
        thumbnailUrl: thumbnailUrl || null,
        tags: parsedTags,
        sourceType: "upload",
        entryFile: "index.html",
        html,
        css: css ?? "",
        fileCount: 1,
        sizeBytes: String(html).length,
        uploadedByEmail: email,
      })
      .returning();
    return res.status(201).json(row);
  }

  const dir = path.join(uploadsRoot(), slug);
  mkdirSync(uploadsRoot(), { recursive: true });
  try {
    extractZipToDir(req.file.buffer, dir);
  } catch (err) {
    return res.status(400).json({ error: err instanceof Error ? err.message : "Could not read archive" });
  }

  const manifest = loadManifest(dir, slug, String(name));
  const [row] = await db
    .insert(siteTemplates)
    .values({
      slug,
      name,
      description: description || manifest.description || null,
      category: category || manifest.category || "General",
      thumbnailUrl: thumbnailUrl || manifest.thumbnail || null,
      tags: parsedTags.length > 0 ? parsedTags : (manifest.tags ?? []),
      sourceType: "upload",
      entryFile: manifest.entry,
      fileCount: listTemplateFiles(dir).length,
      sizeBytes: directorySize(dir),
      uploadedByEmail: email,
    })
    .returning();
  await replacePages(row.id, manifest);
  res.status(201).json(row);
});

adminTemplatesRouter.patch("/:id", async (req, res) => {
  const { name, description, category, thumbnailUrl, tags, isPublished, html, css } = req.body ?? {};
  const [row] = await db
    .update(siteTemplates)
    .set({
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description } : {}),
      ...(category !== undefined ? { category } : {}),
      ...(thumbnailUrl !== undefined ? { thumbnailUrl } : {}),
      ...(tags !== undefined ? { tags } : {}),
      ...(isPublished !== undefined ? { isPublished: Boolean(isPublished) } : {}),
      ...(html !== undefined ? { html } : {}),
      ...(css !== undefined ? { css } : {}),
      updatedAt: new Date(),
    })
    .where(eq(siteTemplates.id, req.params.id))
    .returning();
  if (!row) return res.status(404).json({ error: "Template not found" });
  res.json(row);
});

adminTemplatesRouter.delete("/:id", async (req, res) => {
  const template = await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.id, req.params.id) });
  if (!template) return res.status(404).json({ error: "Template not found" });
  if (template.sourceType === "builtin") {
    return res.status(400).json({ error: "Built-in templates can't be deleted — unpublish it instead" });
  }

  const dir = templateDir(template);
  if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  await db.delete(siteTemplates).where(eq(siteTemplates.id, template.id));
  res.status(204).end();
});

/**
 * Applies a whole template to a client site: every template page becomes an
 * editable site page with the template's CSS/JS inlined, so staff can then
 * overwrite anything for that client without touching the shared template.
 */
adminTemplatesRouter.post("/:id/apply/:slug", async (req, res) => {
  const [template, tenant] = await Promise.all([
    db.query.siteTemplates.findFirst({
      where: eq(siteTemplates.id, req.params.id),
      with: { pages: { orderBy: asc(siteTemplatePages.sortOrder) } },
    }),
    db.query.tenants.findFirst({ where: eq(tenants.slug, req.params.slug) }),
  ]);
  if (!template) return res.status(404).json({ error: "Template not found" });
  if (!tenant) return res.status(404).json({ error: "Tenant not found" });

  const overwrite = req.body?.overwrite !== false;
  const email = await staffEmail(req);
  const dir = templateDir(template);
  const existingPages = await db.query.sitePages.findMany({ where: eq(sitePages.tenantId, tenant.id) });
  const byPath = new Map(existingPages.map((p) => [p.path, p]));

  const manifest = existsSync(dir) ? loadManifest(dir, template.slug, template.name) : null;
  const sources =
    manifest && template.pages.length > 0
      ? template.pages.map((p) => ({ ...p, ...flattenPage(dir, manifest, p.file) }))
      : [
          {
            path: "/",
            title: template.name,
            isHome: true,
            sortOrder: 0,
            html: template.html,
            css: template.css,
          },
        ];

  const applied: string[] = [];
  const skipped: string[] = [];

  for (const source of sources) {
    const existing = byPath.get(source.path);
    const values = {
      title: source.title,
      html: source.html,
      css: source.css,
      isHome: Boolean(source.isHome),
      sortOrder: source.sortOrder,
      templateId: template.id,
      updatedByEmail: email,
      updatedAt: new Date(),
    };

    if (existing) {
      if (!overwrite) {
        skipped.push(source.path);
        continue;
      }
      await db.update(sitePages).set(values).where(eq(sitePages.id, existing.id));
    } else {
      await db.insert(sitePages).values({ tenantId: tenant.id, path: source.path, ...values });
    }
    applied.push(source.path);
  }

  res.status(201).json({ applied, skipped, template: template.name, tenant: tenant.slug });
});

/** Turns an existing client page back into a reusable gallery template. */
adminTemplatesRouter.post("/from-page/:pageId", async (req, res) => {
  const page = await db.query.sitePages.findFirst({ where: eq(sitePages.id, req.params.pageId) });
  if (!page) return res.status(404).json({ error: "Page not found" });

  const name = req.body?.name || `${page.title} template`;
  const baseSlug = slugify(String(name));
  const clash = await db.query.siteTemplates.findFirst({ where: eq(siteTemplates.slug, baseSlug) });

  const [row] = await db
    .insert(siteTemplates)
    .values({
      slug: clash ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug,
      name,
      description: req.body?.description || `Saved from ${page.path}`,
      category: req.body?.category || "Saved Pages",
      sourceType: "upload",
      entryFile: "index.html",
      html: page.html,
      css: page.css,
      fileCount: 1,
      sizeBytes: page.html.length + page.css.length,
      uploadedByEmail: await staffEmail(req),
    })
    .returning();
  res.status(201).json(row);
});

adminTemplatesRouter.get("/gallery/recent", async (_req, res) => {
  const rows = await db.query.siteTemplates.findMany({ orderBy: desc(siteTemplates.createdAt), limit: 6 });
  res.json(rows);
});
