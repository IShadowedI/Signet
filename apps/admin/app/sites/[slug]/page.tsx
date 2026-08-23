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

interface MasterProduct {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
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
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allProducts, setAllProducts] = useState<MasterProduct[]>([]);
  const [catalogProductIds, setCatalogProductIds] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Record<string, boolean>>({});
  const [productQuery, setProductQuery] = useState("");

  const loadCatalog = useCallback(async () => {
    const rows = await api<{ id: string; product: { id: string } }[]>(`/api/admin/catalog/${params.slug}`);
    setCatalogProductIds(new Set(rows.map((r) => r.product.id)));
  }, [params.slug]);

  async function openPicker() {
    setStatus(null);
    const [prods] = await Promise.all([api<MasterProduct[]>("/api/admin/products"), loadCatalog()]);
    setAllProducts(prods);
    setPicked({});
    setProductQuery("");
    setPickerOpen(true);
  }

  async function addPickedProducts() {
    const ids = Object.keys(picked).filter((k) => picked[k]);
    for (const productId of ids) {
      await api(`/api/admin/catalog/${params.slug}`, { method: "POST", body: JSON.stringify({ productId }) });
    }
    setPickerOpen(false);
    await loadCatalog();
    setStatus(ids.length ? `Added ${ids.length} product(s) to ${params.slug}'s store` : "No products selected");
  }

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
            <button
              onClick={openPicker}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Add products
            </button>
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
                    {p.isHome ? (
                      <svg aria-label="Home" viewBox="0 0 24 24" className="mr-1 inline-block h-3.5 w-3.5 align-[-2px]" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M3 11l9-7 9 7" />
                        <path d="M5 10v10h14V10" />
                      </svg>
                    ) : null}
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
                    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="11" height="11" rx="2" />
                      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
                    </svg>
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
                    <svg aria-hidden viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M6 6l12 12M18 6L6 18" />
                    </svg>
                  </button>
                </li>
              ))}
              {pages && pages.length === 0 ? (
                <li className="text-slate-400">No pages yet - apply a template or add one below.</li>
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
                  {selected.template ? `from ${selected.template.name} - ` : ""}
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

      {pickerOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setPickerOpen(false)}>
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">Add products to {params.slug}</h3>
                <p className="text-xs text-slate-500">Pull from the full dashboard catalog into this client store.</p>
              </div>
              <button onClick={() => setPickerOpen(false)} className="text-slate-400 hover:text-slate-700">
                <svg aria-hidden viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            <div className="border-b border-slate-100 px-5 py-2">
              <input
                className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="Search products by name, SKU or brand"
                value={productQuery}
                onChange={(e) => setProductQuery(e.target.value)}
              />
            </div>
            <ul className="flex-1 overflow-auto px-2 py-2 text-sm">
              {allProducts
                .filter((p) => {
                  const q = productQuery.trim().toLowerCase();
                  if (!q) return true;
                  return `${p.name} ${p.sku} ${p.brand ?? ""}`.toLowerCase().includes(q);
                })
                .map((p) => {
                  const already = catalogProductIds.has(p.id);
                  return (
                    <li key={p.id}>
                      <label
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 ${already ? "opacity-50" : "hover:bg-slate-50"}`}
                      >
                        <input
                          type="checkbox"
                          disabled={already}
                          checked={already || Boolean(picked[p.id])}
                          onChange={(e) => setPicked((prev) => ({ ...prev, [p.id]: e.target.checked }))}
                          className="h-4 w-4 accent-indigo-600"
                        />
                        {p.imageUrl ? (
                          <img src={p.imageUrl} alt="" className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <span className="grid h-8 w-8 place-items-center rounded bg-slate-100 text-[10px] text-slate-400">IMG</span>
                        )}
                        <span className="flex-1">
                          <span className="block font-medium text-slate-800">{p.name}</span>
                          <span className="block text-xs text-slate-400">
                            {p.sku}
                            {p.brand ? ` · ${p.brand}` : ""}
                          </span>
                        </span>
                        {already ? <span className="text-xs text-emerald-600">In store</span> : null}
                      </label>
                    </li>
                  );
                })}
              {allProducts.length === 0 ? <li className="px-3 py-6 text-center text-slate-400">No products in the master catalog yet.</li> : null}
            </ul>
            <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
              <button onClick={() => setPickerOpen(false)} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button onClick={addPickedProducts} className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                Add selected
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </Shell>
  );
}
