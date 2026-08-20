"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, PageHeader, shortDate } from "@/components/ui";
import { api } from "@/lib/api";

interface Site {
  slug: string;
  name: string;
  domain: string | null;
  logoUrl: string | null;
  primaryColor: string;
  pageCount: number;
  publishedCount: number;
  hasHome: boolean;
  templates: string[];
  lastEditedAt: string | null;
  lastEditedBy: string | null;
}

export default function SitesPage() {
  const [sites, setSites] = useState<Site[] | null>(null);

  useEffect(() => {
    api<Site[]>("/api/admin/sites").then(setSites);
  }, []);

  return (
    <Shell>
      <PageHeader
        title="Ongoing Sites"
        subtitle="Every client site currently being built or maintained, and who touched it last."
        actions={
          <Link href="/templates" className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
            Start from a template
          </Link>
        }
      />

      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {sites?.map((s) => (
          <Card key={s.slug} className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
                style={{ background: s.primaryColor }}
              >
                {s.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold text-slate-800">{s.name}</div>
                <div className="truncate text-xs text-slate-400">{s.domain ?? `${s.slug}.signet`}</div>
              </div>
            </div>

            <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
              <div className="rounded-md bg-slate-50 py-2">
                <dt className="text-[10px] uppercase text-slate-400">Pages</dt>
                <dd className="font-semibold text-slate-800">{s.pageCount}</dd>
              </div>
              <div className="rounded-md bg-slate-50 py-2">
                <dt className="text-[10px] uppercase text-slate-400">Live</dt>
                <dd className="font-semibold text-slate-800">{s.publishedCount}</dd>
              </div>
              <div className="rounded-md bg-slate-50 py-2">
                <dt className="text-[10px] uppercase text-slate-400">Home</dt>
                <dd className="font-semibold text-slate-800">{s.hasHome ? "âœ“" : "â€”"}</dd>
              </div>
            </dl>

            <p className="mb-1 truncate text-xs text-slate-500">
              {s.templates.length > 0 ? `Template: ${s.templates.join(", ")}` : "No template applied yet"}
            </p>
            <p className="mb-4 truncate text-xs text-slate-400">
              Last edit {shortDate(s.lastEditedAt)}
              {s.lastEditedBy ? ` by ${s.lastEditedBy}` : ""}
            </p>

            <div className="flex gap-2">
              <Link
                href={`/sites/${s.slug}`}
                className="flex-1 rounded-md bg-slate-900 px-3 py-1.5 text-center text-sm font-medium text-white hover:bg-slate-800"
              >
                Edit pages
              </Link>
              <Link
                href={`/tenants/${s.slug}`}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                Settings
              </Link>
            </div>
          </Card>
        ))}
        {sites && sites.length === 0 ? (
          <p className="col-span-full py-10 text-center text-slate-400">No client sites yet.</p>
        ) : null}
      </div>
    </Shell>
  );
}
