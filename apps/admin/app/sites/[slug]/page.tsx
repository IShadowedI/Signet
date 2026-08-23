"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, PageHeader, shortDate } from "@/components/ui";
import { api, API_URL, ApiError } from "@/lib/api";

interface SitePage {
  id: string;
  path: string;
  title: string;
  html: string;
  css: string;
  js: string;
  isHome: boolean;
  isPublished: boolean;
  seoDescription: string | null;
  updatedAt: string;
  updatedByEmail: string | null;
  template: { name: string } | null;
}

interface Template {
  id: string;
  name: string;
  category: string;
}

type Tab = "html" | "css" | "js" | "settings";

export default function SiteEditorPage({ params }: { params: { slug: string } }) {
  const [pages, setPages] = useState<SitePage[] | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<SitePage | null>(null);
  const [tab, setTab] = useState<Tab>("html");
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [newPage, setNewPage] = useState({ path: "", title: "", templateId: "" });

  const load = useCallback(
    async (keepId?: string) => {
      const rows = await api<SitePage[]>(`/api/admin/sites/${params.slug}/pages`);
      setPages(rows);
      const next = rows.find((p) => p.id === keepId) ?? rows.find((p) => p.isHome) ?? rows[0] ?? null;
      setSelected(next);
      setDirty(false);
    },
    [params.slug],
  );

  useEffect(() => {
    load();
    api<Template[]>("/api/admin/templates").then(setTemplates);
  }, [load]);

  function edit(patch: Partial<SitePage>) {
    if (!selected) return;
    setSelected({ ...selected, ...patch });
    setDirty(true);
  }

  async function save() {
    if (!selected) return;
    setStatus(null);
    try {
      await api(`/api/admin/sites/${params.slug}/pages/${selected.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: selected.title,
          path: selected.path,
          html: selected.html,
          css: selected.css,
          js: selected.js,
          isHome: selected.isHome,
          isPublished: selected.isPublished,
          seoDescription: selected.seoDescription,
        }),
      });
      await load(selected.id);
      setPreviewKey((k) => k + 1);
      setStatus("Saved");
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Save failed");
    }
  }

  async function createPage(e: React.FormEvent) {
    e.preventDefault();
    setStatus(null);
    try {
      const created = await api<SitePage>(`/api/admin/sites/${params.slug}/pages`, {
        method: "POST",
        body: JSON.stringify({ ...newPage, templateId: newPage.templateId || undefined }),
      });
      setNewPage({ path: "", title: "", templateId: "" });
      await load(created.id);
    } catch (err) {
      setStatus(err instanceof ApiError ? err.message : "Could not create page");
    }
  }

  async function saveAsTemplate() {
    if (!selected) return;
    const name = window.prompt("Name this template for the gallery:", `${selected.title} template`);
    if (!name) return;
    await api(`/api/admin/templates/from-page/${selected.id}`, { method: "POST", body: JSON.stringify({ name }) });
    setStatus(`Added "${name}" to the gallery`);
  }

  return (
    <Shell>
      <PageHeader
        title={`Editing ${params.slug}`}
        subtitle="Fully custom HTML, CSS and JS per page. Overwrite anything the template generated."
        actions={
          <>
            <Link href="/sites" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              All sites
            </Link>
            <Link href="/templates" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
              Apply a template
            </Link>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-4">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Pages ({pages?.length ?? 0})
            </h2>
            <ul className="mb-3 flex max-h-72 flex-col gap-0.5 overflow-auto text-sm">
              {pages?.map((p) => (
                <li key={p.id} className="group flex items-center gap-1">
                  <button
                    onClick={() => { setSelected(p); setDirty(false); setPreviewKey((k) => k + 1); }}
                    className={`flex-1 truncate rounded px-2 py-1 text-left ${
                      selected?.id === p.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {p.isHome ? "ðŸ  " : ""}
                    {p.title}
                    <span className="ml-1 text-xs opacity-60">{p.path}</span>
                    {!p.isPublished ? <span className="ml-1 text-xs opacity-60">(draft)</span> : null}
                  </button>
                  <button
                    title="Duplicate"
                    className="hidden px-1 text-xs text-slate-400 hover:text-slate-700 group-hover:block"
                    onClick={async () => {
                      const copy = await api<SitePage>(`/api/admin/sites/${params.slug}/pages/${p.id}/duplicate`, { method: "POST" });
                      load(copy.id);
                    }}
                  >
                    â§‰
                  </button>
                  <button
                    title="Delete"
                    className="hidden px-1 text-xs text-red-400 hover:text-red-600 group-hover:block"
                    onClick={async () => {
                      if (!window.confirm(`Delete ${p.path}?`)) return;
                      await api(`/api/admin/sites/${params.slug}/pages/${p.id}`, { method: "DELETE" });
                      load();
                    }}
                  >
                    âœ•
                  </button>
                </li>
              ))}
              {pages && pages.length === 0 ? (
                <li className="text-slate-400">No pages yet â€” apply a template or add one below.</li>
              ) : null}
            </ul>

            <form onSubmit={createPage} className="flex flex-col gap-2 border-t border-slate-100 pt-3">
              <input
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="/path"
                value={newPage.path}
                onChange={(e) => setNewPage({ ...newPage, path: e.target.value })}
                required
              />
              <input
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="Title"
                value={newPage.title}
                onChange={(e) => setNewPage({ ...newPage, title: e.target.value })}
                required
              />
              <select
                className="rounded border border-slate-300 px-2 py-1 text-sm"
                value={newPage.templateId}
                onChange={(e) => setNewPage({ ...newPage, templateId: e.target.value })}
              >
                <option value="">Blank page</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    Start from: {t.name}
                  </option>
                ))}
              </select>
              <button className="rounded bg-indigo-600 px-2 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Add page
              </button>
            </form>
          </Card>
        </div>

        <div className="lg:col-span-3">
          {selected ? (
            <Card className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2">
                {(["html", "css", "js", "settings"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={`rounded px-2.5 py-1 text-xs font-medium uppercase ${
                      tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-200"
                    }`}
                  >
                    {t}
                  </button>
                ))}
                <span className="ml-auto text-xs text-slate-400">
                  {selected.template ? `from ${selected.template.name} Â· ` : ""}
                  edited {shortDate(selected.updatedAt)}
                  {selected.updatedByEmail ? ` by ${selected.updatedByEmail}` : ""}
                </span>
                <button
                  onClick={saveAsTemplate}
                  className="rounded border border-slate-300 px-2.5 py-1 text-xs hover:bg-white"
                >
                  Save as template
                </button>
                <button
                  onClick={save}
                  disabled={!dirty}
                  className="rounded bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-40"
                >
                  {dirty ? "Save changes" : "Saved"}
                </button>
              </div>

              {tab === "settings" ? (
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <label className="text-xs text-slate-500">
                    Title
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-800"
                      value={selected.title}
                      onChange={(e) => edit({ title: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-slate-500">
                    Path
                    <input
                      className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-sm text-slate-800"
                      value={selected.path}
                      onChange={(e) => edit({ path: e.target.value })}
                    />
                  </label>
                  <label className="text-xs text-slate-500 md:col-span-2">
                    SEO description
                    <textarea
                      className="mt-1 h-20 w-full rounded border border-slate-300 p-2 text-sm text-slate-800"
                      value={selected.seoDescription ?? ""}
                      onChange={(e) => edit({ seoDescription: e.target.value })}
                    />
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input type="checkbox" checked={selected.isHome} onChange={(e) => edit({ isHome: e.target.checked })} />
                    Homepage for this site
                  </label>
                  <label className="flex items-center gap-2 text-sm text-slate-700">
                    <input
                      type="checkbox"
                      checked={selected.isPublished}
                      onChange={(e) => edit({ isPublished: e.target.checked })}
                    />
                    Published
                  </label>
                </div>
              ) : (
                <div className="grid lg:grid-cols-2">
                  <textarea
                    spellCheck={false}
                    className="h-[62vh] resize-none border-r border-slate-200 p-3 font-mono text-xs outline-none"
                    value={tab === "html" ? selected.html : tab === "css" ? selected.css : selected.js}
                    onChange={(e) =>
                      edit(tab === "html" ? { html: e.target.value } : tab === "css" ? { css: e.target.value } : { js: e.target.value })
                    }
                  />
                  <iframe
                    key={previewKey}
                    title="Page preview"
                    sandbox="allow-scripts"
                    className="h-[62vh] w-full bg-white"
                    src={`${API_URL}/api/admin/sites/${params.slug}/pages/${selected.id}/preview`}
                  />
                </div>
              )}
              {status ? <p className="border-t border-slate-100 px-4 py-2 text-xs text-slate-500">{status}</p> : null}
            </Card>
          ) : (
            <Card className="p-10 text-center text-slate-400">
              Select a page on the left, or apply a template from the gallery to scaffold this site.
            </Card>
          )}
        </div>
      </div>
    </Shell>
  );
}
