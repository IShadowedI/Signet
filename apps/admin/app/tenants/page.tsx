"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, ApiError } from "@/lib/api";

interface TenantSummary {
  slug: string;
  name: string;
  domain: string | null;
  erpCustomerCode: string | null;
  punchoutEnabled: boolean;
  requireApproval: boolean;
  products: number;
  users: number;
  orders: number;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [form, setForm] = useState({ slug: "", name: "", domain: "", erpCustomerCode: "" });
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<TenantSummary[]>("/api/admin/tenants").then(setTenants);
  }

  useEffect(load, []);

  async function createTenant(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/admin/tenants", { method: "POST", body: JSON.stringify(form) });
      setForm({ slug: "", name: "", domain: "", erpCustomerCode: "" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create tenant");
    }
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Client Sites</h1>
      <p className="mb-6 text-slate-500">Every branded storefront available to this dashboard.</p>

      <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Domain</th>
              <th className="px-4 py-2">ERP Code</th>
              <th className="px-4 py-2">Products</th>
              <th className="px-4 py-2">Buyers</th>
              <th className="px-4 py-2">Orders</th>
              <th className="px-4 py-2">Punchout</th>
              <th className="px-4 py-2">Approvals</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tenants?.map((t) => (
              <tr key={t.slug}>
                <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-2 text-slate-500">{t.domain ?? "—"}</td>
                <td className="px-4 py-2 text-slate-500">{t.erpCustomerCode ?? "—"}</td>
                <td className="px-4 py-2">{t.products}</td>
                <td className="px-4 py-2">{t.users}</td>
                <td className="px-4 py-2">{t.orders}</td>
                <td className="px-4 py-2">{t.punchoutEnabled ? "Enabled" : "—"}</td>
                <td className="px-4 py-2">{t.requireApproval ? "Required" : "—"}</td>
                <td className="px-4 py-2 text-right">
                  <a
                    href={`http://161.35.109.204/signature/${t.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mr-4 text-orange-600 hover:underline"
                  >
                    161.35.109.204/signature/{t.slug} ↗
                  </a>
                  <Link href={`/tenants/${t.slug}`} className="text-indigo-600 hover:underline">
                    Manage
                  </Link>
                </td>
              </tr>
            ))}
            {tenants && tenants.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  No client sites yet — create one below.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      <div className="max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 font-semibold text-slate-800">Onboard a new client</h2>
        <form onSubmit={createTenant} className="grid grid-cols-2 gap-3">
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Slug (e.g. ford)"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Name (e.g. Ford Motor Company)"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Domain (optional)"
            value={form.domain}
            onChange={(e) => setForm({ ...form, domain: e.target.value })}
          />
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Acumatica/Sage customer code"
            value={form.erpCustomerCode}
            onChange={(e) => setForm({ ...form, erpCustomerCode: e.target.value })}
          />
          <button className="col-span-2 rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700">
            Create client site
          </button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </Shell>
  );
}
