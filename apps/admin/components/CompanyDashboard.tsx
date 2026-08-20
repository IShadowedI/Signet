"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface TenantSummary {
  slug: string;
  name: string;
  orders: number;
}

interface OrderRow {
  id: string;
  status: string;
}

interface InvoiceRow {
  id: string;
  status: string;
}

interface QuoteRow {
  id: string;
  status: string;
}

interface ReturnRow {
  id: string;
  status: string;
}

function StatCard({
  label,
  value,
  href,
  icon,
  tone = "default",
}: {
  label: string;
  value: string | number;
  href: string;
  icon: string;
  tone?: "default" | "warn";
}) {
  return (
    <Link
      href={href}
      className="skeuo-panel rounded-3xl p-4 transition hover:-translate-y-0.5"
    >
      <div className="flex items-center gap-3">
        <span className="skeuo-button grid h-10 w-10 place-items-center rounded-2xl text-xl text-orange-500">{icon}</span>
        <div className="text-[11px] font-bold uppercase tracking-wide text-[color:var(--muted)]">{label}</div>
      </div>
      <div className={`mt-2 text-3xl font-bold ${tone === "warn" ? "text-orange-600" : "text-[color:var(--ink)]"}`}>{value}</div>
      <div className="mt-3 h-1.5 rounded-full bg-slate-300/60"><div className="h-full w-2/3 rounded-full bg-gradient-to-r from-orange-500 to-amber-200" /></div>
    </Link>
  );
}

export function CompanyDashboard() {
  const [tenants, setTenants] = useState<TenantSummary[] | null>(null);
  const [orders, setOrders] = useState<OrderRow[] | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
  const [quotes, setQuotes] = useState<QuoteRow[] | null>(null);
  const [returns, setReturns] = useState<ReturnRow[] | null>(null);

  useEffect(() => {
    api<TenantSummary[]>("/api/admin/tenants").then(setTenants);
    api<OrderRow[]>("/api/admin/orders").then(setOrders).catch(() => setOrders([]));
    api<InvoiceRow[]>("/api/admin/invoices").then(setInvoices).catch(() => setInvoices([]));
    api<QuoteRow[]>("/api/admin/quotes").then(setQuotes).catch(() => setQuotes([]));
    api<ReturnRow[]>("/api/admin/returns").then(setReturns).catch(() => setReturns([]));
  }, []);

  const pendingApproval = orders?.filter((o) => o.status === "pending_approval").length ?? 0;
  const unpaidInvoices = invoices?.filter((i) => ["open", "partially_paid", "past_due"].includes(i.status)).length ?? 0;
  const pastDue = invoices?.filter((i) => i.status === "past_due").length ?? 0;
  const openQuotes = quotes?.filter((q) => q.status === "rep_queued" || q.status === "rep_new").length ?? 0;
  const openReturns = returns?.filter((r) => r.status === "requested").length ?? 0;

  return (
    <Shell>
      <div className="mb-7 flex items-center gap-4">
        <span className="skeuo-orange grid h-20 w-20 place-items-center rounded-3xl text-4xl">Γùê</span>
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-[color:var(--ink)]">Control Dashboard</h1>
          <p className="text-[color:var(--muted)]">A single view of every client site, order, and pending action across Signet.</p>
        </div>
      </div>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Client Sites" value={tenants?.length ?? "ΓÇª"} href="/tenants" icon="ΓÖÜ" />
        <StatCard label="Total Orders" value={orders?.length ?? "ΓÇª"} href="/orders" icon="≡ƒ¢Æ" />
        <StatCard
          label="Pending Approval"
          value={pendingApproval}
          href="/orders"
          icon="Γù╖"
          tone={pendingApproval > 0 ? "warn" : "default"}
        />
        <StatCard label="Open Invoices" value={unpaidInvoices} href="/invoices" icon="Γûú" tone={pastDue > 0 ? "warn" : "default"} />
        <StatCard label="Quotes Awaiting Rep" value={openQuotes} href="/quotes" icon="Γù»" />
        <StatCard label="Open Returns" value={openReturns} href="/returns" icon="Γå⌐" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="skeuo-panel rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-bold text-[color:var(--ink)]">Γûú &nbsp;Client Sites</h2><Link href="/tenants" className="skeuo-orange rounded-xl px-4 py-1 text-xs font-bold">View all</Link></div>
          <ul className="space-y-3 text-sm">
            {tenants?.slice(0, 6).map((t) => (
              <li key={t.slug} className="skeuo-button flex items-center justify-between rounded-2xl px-4 py-3">
                <Link href={`/sites/${t.slug}`} className="font-semibold text-[color:var(--ink)] hover:text-orange-600">
                  {t.name}<span className="ml-2 text-xs font-normal text-[color:var(--muted)]">/store/{t.slug}</span>
                </Link>
                <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">{t.orders} orders</span>
              </li>
            ))}
            {tenants && tenants.length === 0 ? <li className="py-2 text-[color:var(--muted)]">No client sites yet.</li> : null}
          </ul>
        </div>

        <div className="skeuo-panel rounded-3xl p-5">
          <h2 className="mb-3 font-bold text-[color:var(--ink)]">╧ƒ &nbsp;Quick Actions</h2>
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/tenants" className="skeuo-button flex items-center justify-between rounded-2xl px-4 py-3 font-medium">
              <span>ΓÖÜ &nbsp; Onboard a new client</span><span>ΓÇ║</span>
            </Link>
            <Link href="/orders" className="skeuo-button flex items-center justify-between rounded-2xl px-4 py-3 font-medium">
              <span>Γûñ &nbsp; Review pending order approvals</span><span>ΓÇ║</span>
            </Link>
            <Link href="/invoices" className="skeuo-button flex items-center justify-between rounded-2xl px-4 py-3 font-medium">
              <span>Γûú &nbsp; Raise or take payment on invoices</span><span>ΓÇ║</span>
            </Link>
            <Link href="/sites" className="skeuo-button flex items-center justify-between rounded-2xl px-4 py-3 font-medium">
              <span>Γûú &nbsp; Edit a client&apos;s site pages</span><span>ΓÇ║</span>
            </Link>
            <Link href="/templates" className="skeuo-button flex items-center justify-between rounded-2xl px-4 py-3 font-medium">
              <span>Γç⌐ &nbsp; Browse or import a site template</span><span>ΓÇ║</span>
            </Link>
          </div>
        </div>
      </div>

      <section className="skeuo-panel mt-6 rounded-3xl p-5">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-[color:var(--ink)]">Orders &amp; Activity</h2>
            <p className="text-xs text-[color:var(--muted)]">Order volume across all active client sites</p>
          </div>
          <div className="flex items-center gap-4 text-xs font-medium text-[color:var(--muted)]">
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-orange-500" /> Orders</span>
            <span className="flex items-center gap-1"><i className="h-2 w-2 rounded-full bg-slate-400" /> Site activity</span>
          </div>
        </div>
        <div className="relative h-52 overflow-hidden rounded-2xl skeuo-inset px-5 pb-7 pt-4">
          <div className="absolute inset-x-5 top-6 border-t border-dashed border-[color:var(--line)]" />
          <div className="absolute inset-x-5 top-[5.8rem] border-t border-dashed border-[color:var(--line)]" />
          <div className="absolute inset-x-5 top-[9.5rem] border-t border-dashed border-[color:var(--line)]" />
          <svg viewBox="0 0 1000 180" preserveAspectRatio="none" className="relative h-full w-full overflow-visible" aria-label="Orders and activity graph">
            <defs>
              <linearGradient id="ordersFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#ff7900" stopOpacity="0.28" />
                <stop offset="1" stopColor="#ff7900" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d="M0 135 L100 118 L200 128 L300 82 L400 104 L500 58 L600 90 L700 45 L800 72 L900 28 L1000 52 L1000 180 L0 180 Z" fill="url(#ordersFill)" />
            <path d="M0 135 L100 118 L200 128 L300 82 L400 104 L500 58 L600 90 L700 45 L800 72 L900 28 L1000 52" fill="none" stroke="#ff7200" strokeWidth="4" vectorEffect="non-scaling-stroke" />
            <path d="M0 152 L100 144 L200 155 L300 125 L400 137 L500 112 L600 128 L700 104 L800 116 L900 82 L1000 98" fill="none" stroke="#8491a2" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
          </svg>
          <div className="absolute bottom-2 left-5 right-5 flex justify-between text-[10px] text-[color:var(--muted)]"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>
        </div>
      </section>
    </Shell>
  );
}

