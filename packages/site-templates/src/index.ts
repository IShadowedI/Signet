import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import AdmZip from "adm-zip";

export interface TemplateManifestPage {
  file: string;
  path: string;
  title: string;
  isHome?: boolean;
}

export interface TemplateManifest {
  slug: string;
  name: string;
  description?: string;
  category?: string;
  entry: string;
  thumbnail?: string;
  tags?: string[];
  pages?: TemplateManifestPage[];
  stylesheets?: string[];
  scripts?: string[];
}

/** Root of the templates that ship with Signet (checked into the repo). */
export function builtinTemplatesDir(): string {
  return path.join(__dirname, "..", "templates");
}

/**
 * Resolves a path inside a template root, refusing anything that escapes it.
 * Guards both `../` traversal and absolute-path injection.
 */
export function resolveInTemplate(rootDir: string, relPath: string): string {
  const root = path.resolve(rootDir);
  const target = path.resolve(root, relPath);
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Path escapes template directory");
  }
  return target;
}

/** Every file in a template, as forward-slashed paths relative to its root. */
export function listTemplateFiles(rootDir: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(abs);
      else out.push(path.relative(rootDir, abs).split(path.sep).join("/"));
    }
  };
  if (existsSync(rootDir)) walk(rootDir);
  return out.sort();
}

export function readTemplateFile(rootDir: string, relPath: string): string {
  return readFileSync(resolveInTemplate(rootDir, relPath), "utf8");
}

const HOME_CANDIDATES = ["index.html", "home.html", "main.html", "default.html"];

/**
 * Builds a manifest for an uploaded template that has no template.json, by
 * scanning its HTML/CSS/JS files. Employees can upload a plain HTML theme zip
 * and still get a usable, page-by-page template.
 */
export function inferManifest(rootDir: string, slug: string, name: string): TemplateManifest {
  const files = listTemplateFiles(rootDir);
  const htmlFiles = files.filter((f) => f.toLowerCase().endsWith(".html"));
  const entry =
    htmlFiles.find((f) => HOME_CANDIDATES.includes(f.toLowerCase())) ??
    htmlFiles.find((f) => !f.includes("/")) ??
    htmlFiles[0] ??
    "index.html";

  return {
    slug,
    name,
    entry,
    stylesheets: files.filter((f) => f.toLowerCase().endsWith(".css")),
    scripts: files.filter((f) => f.toLowerCase().endsWith(".js")),
    pages: htmlFiles.map((file) => {
      const base = file.replace(/\.html$/i, "");
      return {
        file,
        path: file === entry ? "/" : `/${base.toLowerCase()}`,
        title: titleFromHtml(rootDir, file) ?? prettify(base),
        isHome: file === entry,
      };
    }),
  };
}

/** Reads a manifest from disk, falling back to inference for plain HTML uploads. */
export function loadManifest(rootDir: string, slug: string, name: string): TemplateManifest {
  const manifestPath = path.join(rootDir, "template.json");
  if (!existsSync(manifestPath)) return inferManifest(rootDir, slug, name);
  const parsed = JSON.parse(readFileSync(manifestPath, "utf8")) as Partial<TemplateManifest>;
  const inferred = inferManifest(rootDir, slug, name);
  return { ...inferred, ...parsed, slug: parsed.slug ?? slug, name: parsed.name ?? name };
}

export function listBuiltinTemplates(): { dir: string; manifest: TemplateManifest }[] {
  const root = builtinTemplatesDir();
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => {
      const dir = path.join(root, e.name);
      return { dir, manifest: loadManifest(dir, e.name, prettify(e.name)) };
    });
}

/**
 * Unpacks an uploaded theme zip into destDir. Rejects zip-slip entries and
 * strips a single redundant wrapper folder so `MyTheme/index.html` behaves the
 * same as a zip rooted at `index.html`.
 */
export function extractZipToDir(buffer: Buffer, destDir: string): void {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries().filter((e) => !e.isDirectory);
  if (entries.length === 0) throw new Error("Archive is empty");

  const names = entries.map((e) => e.entryName.replace(/\\/g, "/"));
  const topLevels = new Set(names.map((n) => n.split("/")[0]));
  const strip = topLevels.size === 1 && names.every((n) => n.includes("/")) ? `${[...topLevels][0]}/` : "";

  if (existsSync(destDir)) rmSync(destDir, { recursive: true, force: true });
  mkdirSync(destDir, { recursive: true });

  for (const entry of entries) {
    const rel = entry.entryName.replace(/\\/g, "/").slice(strip.length);
    if (!rel || rel.startsWith("__MACOSX/") || path.basename(rel) === ".DS_Store") continue;
    const target = resolveInTemplate(destDir, rel);
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, entry.getData());
  }
}

export function directorySize(rootDir: string): number {
  return listTemplateFiles(rootDir).reduce((sum, f) => sum + statSync(path.join(rootDir, f)).size, 0);
}

/**
 * Flattens one template page into the { html, css } pair a site page stores:
 * local <link>ed stylesheets are inlined, local <script src> tags are inlined,
 * and links between the template's own .html files are rewritten to site paths.
 */
export function flattenPage(
  rootDir: string,
  manifest: TemplateManifest,
  pageFile: string,
): { html: string; css: string } {
  const raw = readTemplateFile(rootDir, pageFile);
  const pageDir = path.posix.dirname(pageFile);
  const pathByFile = new Map<string, string>();
  for (const p of manifest.pages ?? []) pathByFile.set(p.file.toLowerCase(), p.path);

  const css: string[] = [];
  let html = raw;

  html = html.replace(/<link\b[^>]*rel=["']?stylesheet["']?[^>]*>/gi, (tag) => {
    const href = /href=["']([^"']+)["']/i.exec(tag)?.[1];
    if (!href || isExternal(href)) return tag; // keep CDN/Google Fonts links as-is
    const rel = path.posix.normalize(path.posix.join(pageDir === "." ? "" : pageDir, href));
    try {
      css.push(`/* ${rel} */\n${readTemplateFile(rootDir, rel)}`);
    } catch {
      return tag;
    }
    return "";
  });

  html = html.replace(/<script\b[^>]*src=["']([^"']+)["'][^>]*><\/script>/gi, (tag, src: string) => {
    if (isExternal(src)) return tag;
    const rel = path.posix.normalize(path.posix.join(pageDir === "." ? "" : pageDir, src));
    try {
      return `<script>\n${readTemplateFile(rootDir, rel)}\n</script>`;
    } catch {
      return tag;
    }
  });

  html = html.replace(/href=["']([^"']+\.html)(#[^"']*)?["']/gi, (tag, href: string, hash = "") => {
    if (isExternal(href)) return tag;
    const rel = path.posix.normalize(path.posix.join(pageDir === "." ? "" : pageDir, href)).toLowerCase();
    const mapped = pathByFile.get(rel);
    return mapped ? `href="${mapped}${hash}"` : tag;
  });

  return { html, css: css.join("\n\n") };
}

function isExternal(url: string): boolean {
  return /^(https?:)?\/\//i.test(url) || url.startsWith("data:") || url.startsWith("//");
}

function titleFromHtml(rootDir: string, file: string): string | null {
  try {
    const head = readTemplateFile(rootDir, file).slice(0, 4000);
    const match = /<title>([^<]+)<\/title>/i.exec(head);
    return match ? match[1].split("—")[0].split("|")[0].trim() : null;
  } catch {
    return null;
  }
}

function prettify(slug: string): string {
  return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "template"
  );
}
