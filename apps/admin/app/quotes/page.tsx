"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { Card, money, PageHeader, shortDate, StatusBadge } from "@/components/ui";
import { api, ApiError } from "@/lib/api";

interface QuoteLine {
  id: string;
  sku: string;
  description: string | null;
  quantity: number;
  unitPrice: number;
}

interface QuoteComment {
  id: string;
  authorType: string;
  authorEmail: string | null;
  body: string;
  createdAt: string;
}

interface Quote {
  id: string;
  quoteNumber: string;
  status: string;
  version: number;
  total: number;
  expiresAt: string | null;
  expired: boolean;
  awaitingRep: boolean;
  assignedWorkerEmail: string | null;
  notes: string | null;
  updatedAt: string;
  tenant: { name: string };
  user: { email: string } | null;
  lines: QuoteLine[];
  comments: QuoteComment[];
}

/** Mirrors the rep-side buttons in Signet's quote workflow. */
const ACTIONS: { key: string; label: string; hint: string }[] = [
  { key: "save", label: "Save quote", hint: "Keep working on it (Rep Saved)" },
  { key: "return_to_user", label: "Return to buyer", hint: "Send back for review (User Queued)" },
  { key: "cancel_return_to_user", label: "Cancel send", hint: "Pull it back from the buyer" },
  { key: "archive", label: "Archive", hint: "Cancel this quote" },
];

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [filter, setFilter] = useState("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api<Quote[]>("/api/admin/quotes").then(setQuotes);
  }

  useEffect(load, []);

  const visible = (quotes ?? []).filter((q) => {
    if (filter === "all") return true;
    if (filter === "open") return !["converted", "cancelled"].includes(q.status);
    if (filter === "awaiting_rep") return q.awaitingRep;
    return q.status === filter;
  });

  async function act(quote: Quote, action: string) {
    setError(null);
    try {
      await api(`/api/admin/quotes/${quote.id}/action/${action}`, {
        method: "POST",
        body: JSON.stringify({ comment: comment || undefined }),
      });
      setComment("");
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Action failed");
    }
  }

  async function convert(quote: Quote) {
    setError(null);
    try {
      await api(`/api/admin/quotes/${quote.id}/convert-to-order`, { method: "POST" });
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not place order");
    }
  }

  async function extend(quote: Quote) {
    await api(`/api/admin/quotes/${quote.id}`, {
      method: "PATCH",
      body: JSON.stringify({ expiresAt: new Date(Date.now() + 30 * 86_400_000).toISOString() }),
    });
    load();
  }

  return (
    <Shell>
      <PageHeader
        title="Quotes"
        subtitle="Quotes move between your reps and the buyer until they're placed or archived."
      />

      <div className="mb-4 flex flex-wrap gap-1">
        {["open", "awaiting_rep", "user_queued", "converted", "cancelled", "all"].map((f) => (
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

      {error ? <p className="mb-3 text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-col gap-4">
        {visible.map((q) => (
          <Card key={q.id} className="p-5">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800">{q.quoteNumber}</span>
                  <span className="text-xs text-slate-400">v{q.version}</span>
                  <StatusBadge value={q.status} />
                  {q.expired ? (
                    <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">expired</span>
                  ) : null}
                </div>
                <div className="text-xs text-slate-400">
                  {q.tenant?.name} · {q.user?.email ?? "no contact"} · {money(q.total)} ·{" "}
                  {q.expiresAt ? `expires ${shortDate(q.expiresAt)}` : "no expiry"}
                  {q.assignedWorkerEmail ? ` · rep ${q.assignedWorkerEmail}` : ""}
                </div>
              </div>
              <button
                className="text-sm text-indigo-600 hover:underline"
                onClick={() => setExpanded(expanded === q.id ? null : q.id)}
              >
                {expanded === q.id ? "Hide detail" : "Open"}
              </button>
            </div>

            {expanded === q.id ? (
              <>
                <table className="mb-4 w-full text-xs">
                  <thead className="text-left uppercase text-slate-400">
                    <tr>
                      <th className="py-1">SKU</th>
                      <th className="py-1">Description</th>
                      <th className="py-1">Qty</th>
                      <th className="py-1">Unit</th>
                      <th className="py-1">Ext.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {q.lines.map((l) => (
                      <tr key={l.id} className="border-t border-slate-100">
                        <td className="py-1 font-mono">{l.sku}</td>
                        <td className="py-1 text-slate-500">{l.description ?? "—"}</td>
                        <td className="py-1">{l.quantity}</td>
                        <td className="py-1">{money(l.unitPrice)}</td>
                        <td className="py-1">{money(l.quantity * l.unitPrice)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="mb-4">
                  <h4 className="mb-1 text-xs font-semibold uppercase text-slate-400">Conversation</h4>
                  <ul className="mb-2 flex flex-col gap-1 text-xs">
                    {q.comments.map((c) => (
                      <li key={c.id} className="rounded bg-slate-50 px-2 py-1">
                        <span className="font-medium text-slate-600">
                          {c.authorType === "worker" ? c.authorEmail ?? "Rep" : "Buyer"}
                        </span>{" "}
                        <span className="text-slate-400">{shortDate(c.createdAt)}</span>
                        <div className="text-slate-700">{c.body}</div>
                      </li>
                    ))}
                    {q.comments.length === 0 ? <li className="text-slate-400">No messages yet.</li> : null}
                  </ul>
                  <input
                    className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                    placeholder="Add a note to send with your next action…"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  {q.status !== "converted" && q.status !== "cancelled"
                    ? ACTIONS.map((a) => (
                        <button
                          key={a.key}
                          title={a.hint}
                          onClick={() => act(q, a.key)}
                          className="rounded border border-slate-300 px-3 py-1 hover:bg-slate-50"
                        >
                          {a.label}
                        </button>
                      ))
                    : null}
                  {q.expired ? (
                    <button onClick={() => extend(q)} className="rounded border border-amber-300 bg-amber-50 px-3 py-1 text-amber-800">
                      Extend 30 days
                    </button>
                  ) : null}
                  {q.status !== "converted" && q.status !== "cancelled" ? (
                    <button
                      onClick={() => convert(q)}
                      className="rounded bg-indigo-600 px-3 py-1 font-medium text-white hover:bg-indigo-700"
                    >
                      Place order
                    </button>
                  ) : null}
                </div>
              </>
            ) : null}
          </Card>
        ))}
        {quotes && visible.length === 0 ? <p className="py-10 text-center text-slate-400">No quotes match that filter.</p> : null}
      </div>
    </Shell>
  );
}
