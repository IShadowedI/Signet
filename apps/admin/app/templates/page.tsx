"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, PageHeader } from "@/components/ui";
import { api, apiUpload, ApiError } from "@/lib/api";

interface TemplatePage {
  id: string;
  path: string;
  title: string;
  isHome: boolean;
}

interface Template {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  thumbnailUrl: string | null;
  tags: string[];
  sourceType: "builtin" | "upload";
  fileCount: number;
  sizeBytes: number;
  isPublished: boolean;
  uploadedByEmail: string | null;
  pages: TemplatePage[];
}

function kb(bytes: number): string {
  if (bytes > 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default function TemplateGalleryPage() {
  const [templates, setTemplates] = useState<Template[] | null>(null);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [showImport, setShowImport] = useState(false);

  function load() {
    api<Template[]>("/api/admin/templates").then(setTemplates);
  }

  useEffect(load, []);

  const categories = useMemo(
    () => ["All", ...new Set((templates ?? []).map((t) => t.category))],
    [templates],
  );

  const visible = (templates ?? []).filter((t) => {
    if (category !== "All" && t.category !== category) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.description ?? "").toLowerCase().includes(q) ||
      t.tags.some((tag) => tag.toLowerCase().includes(q))
    );
  });

  return (
    <Shell>
      <PageHeader
        title="Template Gallery"
        subtitle="Every starting point a salesperson can build a client site from. Anyone on the team can import a new one."
        actions={
          <>
            <button
              className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              onClick={async () => {
                await api("/api/admin/templates/sync-builtins", { method: "POST" });
                load();
              }}
            >
              Rescan built-ins
            </button>
            <button
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
              onClick={() => setShowImport((v) => !v)}
            >
              {showImport ? "Close importer" : "Import template"}
            </button>
          </>
        }
      />

      {showImport ? <ImportPanel onDone={() => { setShowImport(false); load(); }} /> : null}

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <input
          className="w-64 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
          placeholder="Search name, description, tagâ€¦"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap gap-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                category === c ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
        <span className="ml-auto text-sm text-slate-400">{visible.length} template(s)</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((t) => (
          <Card key={t.id} className="overflow-hidden">
            <div className="h-40 bg-slate-100">
              {t.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={t.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl text-slate-300">ðŸ§©</div>
              )}
            </div>
            <div className="p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800">{t.name}</h3>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                    t.sourceType === "builtin" ? "bg-slate-900 text-white" : "bg-indigo-100 text-indigo-700"
                  }`}
                >
                  {t.sourceType === "builtin" ? "Built-in" : "Uploaded"}
                </span>
              </div>
              <p className="mb-3 line-clamp-2 text-xs text-slate-500">{t.description ?? "No description."}</p>
              <div className="mb-3 flex flex-wrap gap-1">
                {t.tags.slice(0, 4).map((tag) => (
                  <span key={tag} className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mb-3 text-xs text-slate-400">
                {t.pages.length} page(s) Â· {t.fileCount} file(s) Â· {kb(t.sizeBytes)}
                {t.uploadedByEmail ? ` Â· by ${t.uploadedByEmail}` : ""}
              </div>
              <Link
                href={`/templates/${t.id}`}
                className="inline-block rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
              >
                Preview & use
              </Link>
            </div>
          </Card>
        ))}
        {templates && visible.length === 0 ? (
          <p className="col-span-full py-10 text-center text-slate-400">No templates match that filter.</p>
        ) : null}
      </div>
    </Shell>
  );
}

function ImportPanel({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<"zip" | "paste">("zip");
  const [form, setForm] = useState({ name: "", description: "", category: "", tags: "", thumbnailUrl: "" });
  const [file, setFile] = useState<File | null>(null);
  const [html, setHtml] = useState("");
  const [css, setCss] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const data = new FormData();
      Object.entries(form).forEach(([k, v]) => data.append(k, v));
      if (mode === "zip") {
        if (!file) throw new ApiError(400, "Choose a .zip file to upload");
        data.append("file", file);
      } else {
        data.append("html", html);
        data.append("css", css);
      }
      await apiUpload("/api/admin/templates", data);
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="mb-6 p-6">
      <h2 className="mb-1 font-semibold text-slate-800">Import a template</h2>
      <p className="mb-4 text-sm text-slate-500">
        Upload a plain HTML theme as a .zip (HTML, CSS, JS, images â€” a <code>template.json</code> manifest is optional),
        or paste a single-page snippet. Imported templates join the gallery for everyone.
      </p>

      <div className="mb-4 flex gap-1">
        {(["zip", "paste"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1 text-sm ${mode === m ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {m === "zip" ? "Upload .zip theme" : "Paste HTML/CSS"}
          </button>
        ))}
      </div>

      <form onSubmit={submit} className="grid gap-3 md:grid-cols-2">
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Template name"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          required
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Category (e.g. Apparel & Retail)"
          value={form.category}
          onChange={(e) => setForm({ ...form, category: e.target.value })}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
          placeholder="Short description"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Tags, comma separated"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Thumbnail image URL (optional)"
          value={form.thumbnailUrl}
          onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })}
        />

        {mode === "zip" ? (
          <input
            type="file"
            accept=".zip"
            className="md:col-span-2 text-sm"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        ) : (
          <>
            <textarea
              className="h-32 rounded border border-slate-300 p-2 font-mono text-xs md:col-span-2"
              placeholder="<section>â€¦</section>"
              value={html}
              onChange={(e) => setHtml(e.target.value)}
            />
            <textarea
              className="h-24 rounded border border-slate-300 p-2 font-mono text-xs md:col-span-2"
              placeholder="/* CSS */"
              value={css}
              onChange={(e) => setCss(e.target.value)}
            />
          </>
        )}

        <button
          disabled={busy}
          className="rounded bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 md:col-span-2"
        >
          {busy ? "Importingâ€¦" : "Add to gallery"}
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </Card>
  );
}
