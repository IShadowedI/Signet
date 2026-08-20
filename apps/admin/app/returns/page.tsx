"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, money, PageHeader, shortDate, StatusBadge } from "@/components/ui";
import { api } from "@/lib/api";

interface ReturnLine {
  id: string;
  variantSku: string;
  quantity: number;
  reason: string | null;
  action: string | null;
  unitPrice: number;
}

interface ReturnRow {
  id: string;
  rmaNumber: string | null;
  reason: string | null;
  status: string;
  stage: string | null;
  carrier: string | null;
  trackingNumber: string | null;
  createdAt: string;
  tenant: { name: string };
  user: { email: string } | null;
  lines: ReturnLine[];
}

interface AdhocRow {
  id: string;
  type: string;
  subject: string;
  details: string | null;
  status: string;
  priority: string;
  assignedToEmail: string | null;
  createdAt: string;
  tenant: { name: string };
  user: { email: string } | null;
}

interface Config {
  reasons: { id: string; label: string; active: boolean }[];
  actions: { id: string; label: string; active: boolean }[];
  stages: { id: string; label: string; sortOrder: number; isTerminal: boolean }[];
}

type Tab = "returns" | "requests" | "config";

export default function ReturnsPage() {
  const [tab, setTab] = useState<Tab>("returns");
  const [returns, setReturns] = useState<ReturnRow[] | null>(null);
  const [adhoc, setAdhoc] = useState<AdhocRow[] | null>(null);
  const [config, setConfig] = useState<Config | null>(null);

  function load() {
    api<ReturnRow[]>("/api/admin/returns").then(setReturns);
    api<AdhocRow[]>("/api/admin/returns/adhoc/all").then(setAdhoc);
    api<Config>("/api/admin/returns/config").then(setConfig);
  }

  useEffect(load, []);

  async function patchReturn(id: string, body: Record<string, unknown>) {
    await api(`/api/admin/returns/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    load();
  }

  async function patchAdhoc(id: string, body: Record<string, unknown>) {
    await api(`/api/admin/returns/adhoc/${id}`, { method: "PATCH", body: JSON.stringify(body) });
    load();
  }

  return (
    <Shell>
      <PageHeader
        title="Returns & Requests"
        subtitle="RMA authorisation, return stages, and every ad-hoc customer request your team is tracking."
      />

      <div className="mb-5 flex gap-1">
        {([
          ["returns", `Returns (${returns?.length ?? 0})`],
          ["requests", `Ad-hoc requests (${adhoc?.length ?? 0})`],
          ["config", "RMA setup"],
        ] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`rounded-md px-3 py-1.5 text-sm ${tab === key ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "returns" ? (
        <div className="flex flex-col gap-4">
          {returns?.map((r) => (
            <Card key={r.id} className="p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-800">{r.rmaNumber ?? "Not yet authorised"}</span>
                    <StatusBadge value={r.status} />
                    {r.stage ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.stage}</span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-400">
                    {r.tenant?.name} · {r.user?.email ?? "—"} · requested {shortDate(r.createdAt)} · {r.reason ?? "no reason given"}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {r.status === "requested" ? (
                    <>
                      <button
                        className="rounded bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
                        onClick={() => patchReturn(r.id, { status: "approved", stage: "Authorised" })}
                      >
                        Authorise (issue RMA)
                      </button>
                      <button
                        className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
                        onClick={() => patchReturn(r.id, { status: "rejected" })}
                      >
                        Reject
                      </button>
                    </>
                  ) : null}
                  {r.status === "approved" ? (
                    <button
                      className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
                      onClick={() => patchReturn(r.id, { status: "completed", stage: "Credited" })}
                    >
                      Mark credited
                    </button>
                  ) : null}
                  {config ? (
                    <select
                      className="rounded border border-slate-300 px-2 py-1"
                      value={r.stage ?? ""}
                      onChange={(e) => patchReturn(r.id, { stage: e.target.value })}
                    >
                      <option value="">Set stage…</option>
                      {config.stages.map((s) => (
                        <option key={s.id} value={s.label}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  ) : null}
                </div>
              </div>

              <table className="w-full text-xs">
                <thead className="text-left uppercase text-slate-400">
                  <tr>
                    <th className="py-1">SKU</th>
                    <th className="py-1">Qty</th>
                    <th className="py-1">Reason</th>
                    <th className="py-1">Requested action</th>
                    <th className="py-1">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {r.lines.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="py-1 font-mono">{l.variantSku}</td>
                      <td className="py-1">{l.quantity}</td>
                      <td className="py-1 text-slate-500">{l.reason ?? "—"}</td>
                      <td className="py-1 text-slate-500">{l.action ?? "—"}</td>
                      <td className="py-1">{money(l.quantity * l.unitPrice)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
                <span>Carrier: {r.carrier ?? "—"}</span>
                <span>Tracking: {r.trackingNumber ?? "—"}</span>
              </div>
            </Card>
          ))}
          {returns && returns.length === 0 ? <p className="py-10 text-center text-slate-400">No returns requested yet.</p> : null}
        </div>
      ) : null}

      {tab === "requests" ? (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-2">Client</th>
                <th className="px-4 py-2">Type</th>
                <th className="px-4 py-2">Subject</th>
                <th className="px-4 py-2">Priority</th>
                <th className="px-4 py-2">Assigned</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adhoc?.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 text-slate-700">{a.tenant?.name}</td>
                  <td className="px-4 py-2 text-slate-500">{a.type}</td>
                  <td className="px-4 py-2">
                    <div className="text-slate-800">{a.subject}</div>
                    <div className="text-xs text-slate-400">{a.user?.email ?? "—"} · {shortDate(a.createdAt)}</div>
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                      value={a.priority}
                      onChange={(e) => patchAdhoc(a.id, { priority: e.target.value })}
                    >
                      {["low", "normal", "high", "urgent"].map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-500">
                    {a.assignedToEmail ?? (
                      <button
                        className="text-indigo-600 hover:underline"
                        onClick={async () => {
                          await api(`/api/admin/returns/adhoc/${a.id}/claim`, { method: "POST" });
                          load();
                        }}
                      >
                        Claim
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge value={a.status} />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      className="rounded border border-slate-200 px-1 py-0.5 text-xs"
                      value={a.status}
                      onChange={(e) => patchAdhoc(a.id, { status: e.target.value })}
                    >
                      {["open", "in_progress", "waiting_on_customer", "resolved", "closed"].map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {adhoc && adhoc.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                    No ad-hoc requests yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </Card>
      ) : null}

      {tab === "config" ? (
        <div className="grid gap-5 md:grid-cols-3">
          <ConfigList title="Return reasons" endpoint="reasons" items={config?.reasons ?? []} onChange={load} />
          <ConfigList title="Return actions" endpoint="actions" items={config?.actions ?? []} onChange={load} />
          <ConfigList title="Return stages" endpoint="stages" items={config?.stages ?? []} onChange={load} />
        </div>
      ) : null}
    </Shell>
  );
}

function ConfigList({
  title,
  endpoint,
  items,
  onChange,
}: {
  title: string;
  endpoint: string;
  items: { id: string; label: string; active?: boolean }[];
  onChange: () => void;
}) {
  const [label, setLabel] = useState("");

  return (
    <Card className="p-4">
      <h2 className="mb-1 font-semibold text-slate-800">{title}</h2>
      <p className="mb-3 text-xs text-slate-400">Edited here rather than in code, so ops can adapt the workflow.</p>
      <ul className="mb-3 flex flex-col gap-1 text-sm">
        {items.map((i) => (
          <li key={i.id} className="flex items-center justify-between rounded px-2 py-1 hover:bg-slate-50">
            <span className={i.active === false ? "text-slate-400 line-through" : "text-slate-700"}>{i.label}</span>
            <button
              className="text-xs text-red-500 hover:underline"
              onClick={async () => {
                await api(`/api/admin/returns/config/${endpoint}/${i.id}`, { method: "DELETE" });
                onChange();
              }}
            >
              Retire
            </button>
          </li>
        ))}
        {items.length === 0 ? <li className="text-slate-400">None configured.</li> : null}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!label.trim()) return;
          await api(`/api/admin/returns/config/${endpoint}`, {
            method: "POST",
            body: JSON.stringify({ label, sortOrder: items.length }),
          });
          setLabel("");
          onChange();
        }}
      >
        <input
          className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
          placeholder="Add…"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
        <button className="rounded bg-slate-900 px-3 py-1 text-sm text-white hover:bg-slate-800">Add</button>
      </form>
    </Card>
  );
}
