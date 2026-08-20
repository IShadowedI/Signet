"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, PageHeader } from "@/components/ui";
import { api, API_URL, ApiError } from "@/lib/api";

interface TemplatePage {
  id: string;
  file: string;
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
  tags: string[];
  sourceType: "builtin" | "upload";
  fileCount: number;
  isPublished: boolean;
  pages: TemplatePage[];
  files: string[];
}

interface Site {
  slug: string;
  name: string;
  pageCount: number;
}

export default function TemplateDetailPage({ params }: { params: { id: string } }) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [activePage, setActivePage] = useState<string | null>(null);
  const [targetSite, setTargetSite] = useState("");
  const [overwrite, setOverwrite] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Template>(`/api/admin/templates/${params.id}`).then((t) => {
      setTemplate(t);
      setActivePage(t.pages.find((p) => p.isHome)?.id ?? t.pages[0]?.id ?? null);
    });
    api<Site[]>("/api/admin/sites").then((rows) => {
      setSites(rows);
      if (rows.length > 0) setTargetSite(rows[0].slug);
    });
  }, [params.id]);

  async function applyToSite() {
    setError(null);
    setResult(null);
    try {
      const res = await api<{ applied: string[]; skipped: string[] }>(
        `/api/admin/templates/${params.id}/apply/${targetSite}`,
        { method: "POST", body: JSON.stringify({ overwrite }) },
      );
      setResult(
        `Created/updated ${res.applied.length} page(s)${res.skipped.length ? `, skipped ${res.skipped.length} existing` : ""}.`,
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not apply template");
    }
  }

  if (!template) return <Shell><p className="text-slate-500">Loadingâ€¦</p></Shell>;

  return (
    <Shell>
      <PageHeader
        title={template.name}
        subtitle={template.description ?? undefined}
        actions={
          <Link href="/templates" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50">
            Back to gallery
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-4">
        <div className="flex flex-col gap-4 lg:col-span-1">
          <Card className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Pages</h2>
            <ul className="flex flex-col gap-0.5 text-sm">
              {template.pages.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => setActivePage(p.id)}
                    className={`w-full rounded px-2 py-1 text-left ${
                      activePage === p.id ? "bg-indigo-600 text-white" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {p.title} {p.isHome ? "ðŸ " : ""}
                    <span className="ml-1 text-xs opacity-60">{p.path}</span>
                  </button>
                </li>
              ))}
              {template.pages.length === 0 ? <li className="text-slate-400">Single-snippet template.</li> : null}
            </ul>
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Use this template</h2>
            <select
              className="mb-2 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
              value={targetSite}
              onChange={(e) => setTargetSite(e.target.value)}
            >
              {sites.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name} ({s.pageCount} pages)
                </option>
              ))}
            </select>
            <label className="mb-3 flex items-center gap-2 text-xs text-slate-600">
              <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
              Overwrite pages that already exist
            </label>
            <button
              onClick={applyToSite}
              disabled={!targetSite}
              className="w-full rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Apply to site
            </button>
            {result ? (
              <p className="mt-2 text-xs text-green-700">
                {result}{" "}
                <Link href={`/sites/${targetSite}`} className="underline">
                  Open site
                </Link>
              </p>
            ) : null}
            {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
          </Card>

          <Card className="p-4">
            <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Files ({template.files.length})
            </h2>
            <ul className="max-h-56 overflow-auto text-xs text-slate-500">
              {template.files.map((f) => (
                <li key={f} className="truncate py-0.5 font-mono">
                  {f}
                </li>
              ))}
              {template.files.length === 0 ? <li>Stored inline (no source files).</li> : null}
            </ul>
          </Card>
        </div>

        <Card className="overflow-hidden lg:col-span-3">
          <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500">
            <span>Live preview</span>
            <span className="uppercase">{template.sourceType}</span>
          </div>
          {/* Sandboxed: template markup is untrusted employee-uploaded content. */}
          <iframe
            title="Template preview"
            sandbox=""
            className="h-[70vh] w-full bg-white"
            src={`${API_URL}/api/admin/templates/${template.id}/preview/${activePage ?? ""}`}
          />
        </Card>
      </div>
    </Shell>
  );
}
