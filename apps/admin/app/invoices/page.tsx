"use client";

import { useEffect, useMemo, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, money, PageHeader, shortDate, StatusBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceType: "IN" | "CM" | "FC";
  amount: number;
  amountPaid: number;
  balance: number;
  status: string;
  payable: boolean;
  poNumber: string | null;
  terms: string | null;
  dueDate: string | null;
  issuedAt: string;
  lockedUntil: string | null;
  tenant: { name: string; slug: string };
}

interface AgingRow {
  tenant: string;
  current: number;
  d30: number;
  d60: number;
  d90: number;
  d90plus: number;
}

const TYPE_LABELS: Record<string, string> = { IN: "Invoice", CM: "Credit memo", FC: "Finance charge" };

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [aging, setAging] = useState<AgingRow[]>([]);
  const [filter, setFilter] = useState("all");
  const [selection, setSelection] = useState<Record<string, string>>({});
  const [method, setMethod] = useState("card-token");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showRaise, setShowRaise] = useState(false);

  function load() {
    api<Invoice[]>("/api/admin/invoices").then(setInvoices);
    api<AgingRow[]>("/api/admin/invoices/aging").then(setAging);
    setSelection({});
  }

  useEffect(load, []);

  const visible = (invoices ?? []).filter((i) => {
    if (filter === "all") return true;
    if (filter === "outstanding") return i.balance > 0 && i.status !== "void";
    return i.status === filter;
  });

  // Multi-invoice payment only makes sense within one client's AR account.
  const selectedRows = (invoices ?? []).filter((i) => selection[i.id] !== undefined);
  const paySlug = selectedRows[0]?.tenant.slug;
  const mixedClients = new Set(selectedRows.map((r) => r.tenant.slug)).size > 1;
  const payTotal = useMemo(
    () => Object.values(selection).reduce((s, v) => s + (Number(v) || 0), 0),
    [selection],
  );

  function toggle(inv: Invoice) {
    setSelection((prev) => {
      const next = { ...prev };
      if (next[inv.id] !== undefined) delete next[inv.id];
      else next[inv.id] = inv.balance.toFixed(2);
      return next;
    });
  }

  async function pay() {
    setError(null);
    setNotice(null);
    try {
      const res = await api<{ appliedTo: number }>(`/api/admin/invoices/payments/${paySlug}`, {
        method: "POST",
        body: JSON.stringify({
          method,
          allocations: Object.entries(selection).map(([invoiceId, amount]) => ({ invoiceId, amount: Number(amount) })),
        }),
      });
      setNotice(`Payment of ${money(payTotal)} applied to ${res.appliedTo} invoice(s).`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Payment failed");
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Invoices"
        subtitle="Open AR, aging and online payments. Tick several invoices to settle them in one transaction."
        actions={
          <button
            className="rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={() => setShowRaise((v) => !v)}
          >
            {showRaise ? "Close" : "Raise invoice"}
          </button>
        }
      />

      {showRaise ? <RaiseInvoice onDone={() => { setShowRaise(false); load(); }} /> : null}

      {aging.length > 0 ? (
        <Card className="mb-6 overflow-hidden">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase text-slate-500">
            Invoice aging
          </div>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-400">
              <tr>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Current</th>
                <th className="px-4 py-2">1â€“30</th>
                <th className="px-4 py-2">31â€“60</th>
                <th className="px-4 py-2">61â€“90</th>
                <th className="px-4 py-2">90+</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {aging.map((a) => (
                <tr key={a.tenant}>
                  <td className="px-4 py-2 font-medium text-slate-700">{a.tenant}</td>
                  <td className="px-4 py-2">{money(a.current)}</td>
                  <td className="px-4 py-2">{money(a.d30)}</td>
                  <td className="px-4 py-2 text-amber-700">{money(a.d60)}</td>
                  <td className="px-4 py-2 text-amber-700">{money(a.d90)}</td>
                  <td className="px-4 py-2 font-semibold text-red-700">{money(a.d90plus)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : null}

      <div className="mb-3 flex flex-wrap gap-1">
        {["all", "outstanding", "open", "partially_paid", "past_due", "paid", "void"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filter === f ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
            }`}
          >
            {f.replace(/_/g, " ")}
          </button>
        ))}
      </div>

      <Card className="mb-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="w-8 px-4 py-2" />
              <th className="px-4 py-2">Invoice</th>
              <th className="px-4 py-2">Client</th>
              <th className="px-4 py-2">Type</th>
              <th className="px-4 py-2">Amount</th>
              <th className="px-4 py-2">Paid</th>
              <th className="px-4 py-2">Balance</th>
              <th className="px-4 py-2">Due</th>
              <th className="px-4 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((inv) => (
              <tr key={inv.id} className={selection[inv.id] !== undefined ? "bg-indigo-50/50" : undefined}>
                <td className="px-4 py-2">
                  <input
                    type="checkbox"
                    disabled={!inv.payable || inv.balance <= 0}
                    checked={selection[inv.id] !== undefined}
                    onChange={() => toggle(inv)}
                  />
                </td>
                <td className="px-4 py-2 font-medium text-slate-800">
                  {inv.invoiceNumber}
                  {inv.poNumber ? <div className="text-xs text-slate-400">PO {inv.poNumber}</div> : null}
                </td>
                <td className="px-4 py-2 text-slate-500">{inv.tenant?.name}</td>
                <td className="px-4 py-2 text-xs text-slate-500">{TYPE_LABELS[inv.invoiceType]}</td>
                <td className="px-4 py-2">{money(inv.amount)}</td>
                <td className="px-4 py-2 text-slate-500">{money(inv.amountPaid)}</td>
                <td className="px-4 py-2 font-medium">{money(inv.balance)}</td>
                <td className="px-4 py-2 text-slate-500">{shortDate(inv.dueDate)}</td>
                <td className="px-4 py-2">
                  <StatusBadge value={inv.status} />
                  {inv.lockedUntil && new Date(inv.lockedUntil) > new Date() ? (
                    <button
                      className="ml-2 text-xs text-indigo-600 hover:underline"
                      onClick={async () => {
                        await api(`/api/admin/invoices/${inv.id}/unlock`, { method: "POST" });
                        load();
                      }}
                    >
                      unlock
                    </button>
                  ) : null}
                </td>
              </tr>
            ))}
            {invoices && visible.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-slate-400">
                  No invoices match that filter.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </Card>

      {selectedRows.length > 0 ? (
        <Card className="p-4">
          <h2 className="mb-3 font-semibold text-slate-800">
            Take payment â€” {selectedRows.length} invoice(s), {money(payTotal)}
          </h2>
          {mixedClients ? (
            <p className="text-sm text-red-600">Select invoices from a single client to pay them together.</p>
          ) : (
            <>
              <div className="mb-3 flex flex-col gap-2">
                {selectedRows.map((inv) => (
                  <div key={inv.id} className="flex items-center gap-3 text-sm">
                    <span className="w-40 truncate text-slate-600">{inv.invoiceNumber}</span>
                    <span className="text-xs text-slate-400">balance {money(inv.balance)}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0.01"
                      max={inv.balance}
                      className="w-28 rounded border border-slate-300 px-2 py-1 text-sm"
                      value={selection[inv.id]}
                      onChange={(e) => setSelection({ ...selection, [inv.id]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <select
                  className="rounded border border-slate-300 px-2 py-1.5 text-sm"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="card-token">Credit / debit card</option>
                  <option value="ach">ACH / bank transfer</option>
                  <option value="po">On account (PO / terms)</option>
                  <option value="allotment">Allotment balance</option>
                </select>
                <button
                  onClick={pay}
                  className="rounded bg-indigo-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
                >
                  Apply payment
                </button>
                <button onClick={() => setSelection({})} className="text-sm text-slate-500 hover:underline">
                  Clear
                </button>
              </div>
            </>
          )}
          {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
        </Card>
      ) : null}

      {notice ? <p className="mt-3 text-sm text-green-700">{notice}</p> : null}
    </Shell>
  );
}

function RaiseInvoice({ onDone }: { onDone: () => void }) {
  const [tenants, setTenants] = useState<{ slug: string; name: string }[]>([]);
  const [form, setForm] = useState({ slug: "", amount: "", invoiceType: "IN", dueDate: "", poNumber: "", terms: "" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<{ slug: string; name: string }[]>("/api/admin/tenants").then((rows) => {
      setTenants(rows);
      if (rows[0]) setForm((f) => ({ ...f, slug: rows[0].slug }));
    });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { slug, ...body } = form;
      await api(`/api/admin/invoices/${slug}`, { method: "POST", body: JSON.stringify(body) });
      onDone();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not raise invoice");
    }
  }

  return (
    <Card className="mb-6 p-6">
      <h2 className="mb-4 font-semibold text-slate-800">Raise an invoice</h2>
      <form onSubmit={submit} className="grid gap-3 md:grid-cols-3">
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={form.slug}
          onChange={(e) => setForm({ ...form, slug: e.target.value })}
        >
          {tenants.map((t) => (
            <option key={t.slug} value={t.slug}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={form.invoiceType}
          onChange={(e) => setForm({ ...form, invoiceType: e.target.value })}
        >
          <option value="IN">Invoice</option>
          <option value="CM">Credit memo</option>
          <option value="FC">Finance charge</option>
        </select>
        <input
          type="number"
          step="0.01"
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Amount"
          value={form.amount}
          onChange={(e) => setForm({ ...form, amount: e.target.value })}
          required
        />
        <input
          type="date"
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={form.dueDate}
          onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="PO number"
          value={form.poNumber}
          onChange={(e) => setForm({ ...form, poNumber: e.target.value })}
        />
        <input
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          placeholder="Terms (e.g. Net 30)"
          value={form.terms}
          onChange={(e) => setForm({ ...form, terms: e.target.value })}
        />
        <button className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-700 md:col-span-3">
          Create invoice
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
    </Card>
  );
}
