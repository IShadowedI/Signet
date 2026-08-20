"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, ApiError } from "@/lib/api";

interface Me { role: string; tenant: { slug: string; name: string } | null; }
interface Tenant { slug: string; name: string; orders: number; products: number; users: number; }
interface Staff { id: string; username: string; name: string; role: string; tenant: { slug: string; name: string } | null; }
interface Order { id: string; status: string; }

export default function DashboardPage() {
  const [me, setMe] = useState<Me | null>(null);
  useEffect(() => { api<Me>("/api/auth/internal/me").then(setMe); }, []);
  if (!me) return <Shell><p className="text-[color:var(--muted)]">Loading dashboard...</p></Shell>;
  return me.role === "owner" ? <OwnerDashboard /> : <CompanyDashboard me={me} />;
}

function OwnerDashboard() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [form, setForm] = useState({ name: "", username: "", password: "", role: "employee", tenantSlug: "" });
  const [error, setError] = useState<string | null>(null);
  function load() { api<Tenant[]>("/api/admin/tenants").then(setTenants); api<Staff[]>("/api/admin/staff").then(setStaff); }
  useEffect(load, []);
  async function create(event: React.FormEvent) {
    event.preventDefault(); setError(null);
    try { await api("/api/admin/staff", { method: "POST", body: JSON.stringify(form) }); setForm({ name: "", username: "", password: "", role: "employee", tenantSlug: form.tenantSlug }); load(); }
    catch (err) { setError(err instanceof ApiError ? err.message : "Could not create account"); }
  }
  return <Shell>
    <div className="mb-7"><h1 className="text-4xl font-bold text-[color:var(--ink)]">Signet Owner Console</h1><p className="text-[color:var(--muted)]">Maintenance, company health, and account management across all client dashboards.</p></div>
    <div className="mb-6 grid grid-cols-3 gap-4"><Metric label="Client companies" value={tenants.length} /><Metric label="Staff accounts" value={staff.length} /><Metric label="Monitored dashboards" value={tenants.length} /></div>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="skeuo-panel rounded-3xl p-5"><h2 className="mb-3 font-bold">Company dashboards</h2><div className="space-y-2">{tenants.map((tenant) => <div key={tenant.slug} className="skeuo-button flex items-center justify-between rounded-2xl px-4 py-3"><span><b>{tenant.name}</b><small className="ml-2 text-[color:var(--muted)]">{tenant.users} users · {tenant.products} products</small></span><Link className="text-orange-600 hover:underline" href={`/tenants/${tenant.slug}`}>Inspect</Link></div>)}</div></section>
      <section className="skeuo-panel rounded-3xl p-5"><h2 className="mb-3 font-bold">Create company account</h2><form onSubmit={create} className="grid gap-3"><input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Display name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required /><input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Username" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} required /><input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Temporary password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /><select className="rounded border border-slate-300 px-3 py-2 text-sm" value={form.tenantSlug} onChange={(e) => setForm({ ...form, tenantSlug: e.target.value })} required><option value="">Choose company</option>{tenants.map((tenant) => <option key={tenant.slug} value={tenant.slug}>{tenant.name}</option>)}</select><select className="rounded border border-slate-300 px-3 py-2 text-sm" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}><option value="admin">Company admin</option><option value="employee">Employee</option></select><button className="skeuo-orange rounded-xl px-4 py-2 text-sm font-bold">Create account</button>{error ? <p className="text-sm text-red-600">{error}</p> : null}</form></section>
    </div>
    <section className="skeuo-panel mt-6 rounded-3xl p-5"><h2 className="mb-3 font-bold">Account registry</h2><div className="grid gap-2 md:grid-cols-2">{staff.map((user) => <div key={user.id} className="skeuo-button rounded-2xl px-4 py-3"><b>{user.name}</b><div className="text-xs text-[color:var(--muted)]">{user.username} · {user.tenant?.name ?? "Signet"} · {user.role}</div></div>)}</div></section>
  </Shell>;
}

function CompanyDashboard({ me }: { me: Me }) {
  const [orders, setOrders] = useState<Order[]>([]);
  useEffect(() => { api<Order[]>("/api/admin/orders").then(setOrders); }, []);
  const company = me.tenant?.name ?? "Company";
  return <Shell>
    <div className="mb-7"><h1 className="text-4xl font-bold text-[color:var(--ink)]">{company} Dashboard</h1><p className="text-[color:var(--muted)]">Your company workspace for orders, products, quotes, and site operations.</p></div>
    <div className="mb-6 grid grid-cols-3 gap-4"><Metric label="Company orders" value={orders.length} /><Metric label="Active workspace" value="1" /><Metric label="Account role" value={me.role} /></div>
    <section className="skeuo-panel rounded-3xl p-5"><div className="mb-3 flex items-center justify-between"><h2 className="font-bold">Recent company orders</h2><Link href="/orders" className="text-orange-600 hover:underline">View orders</Link></div><div className="space-y-2">{orders.slice(0, 8).map((order) => <div key={order.id} className="skeuo-button rounded-2xl px-4 py-3"><b>Order {order.id.slice(0, 8)}</b><span className="ml-3 text-xs text-[color:var(--muted)]">{order.status}</span></div>)}{orders.length === 0 ? <p className="text-sm text-[color:var(--muted)]">No orders yet.</p> : null}</div></section>
  </Shell>;
}

function Metric({ label, value }: { label: string; value: string | number }) { return <div className="skeuo-panel rounded-3xl p-5"><div className="text-xs font-bold uppercase text-[color:var(--muted)]">{label}</div><div className="mt-2 text-3xl font-bold">{value}</div></div>; }
