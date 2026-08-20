"use client";

import { useEffect, useState } from "react";
import { Shell } from "@/components/Shell";
import { api } from "@/lib/api";

interface Order {
  id: string;
  status: string;
  paymentMethod: string;
  poNumber: string | null;
  erpOrderId: string | null;
  createdAt: string;
  tenant: { name: string; slug: string };
  user: { name: string; email: string } | null;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[] | null>(null);

  function load() {
    api<Order[]>("/api/admin/orders").then(setOrders);
  }
  useEffect(load, []);

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Orders</h1>
      <p className="mb-6 text-slate-500">Every order across all client sites, with ERP submission status.</p>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Date</th>
            <th className="px-4 py-2">Client</th>
            <th className="px-4 py-2">Buyer</th>
            <th className="px-4 py-2">Payment</th>
            <th className="px-4 py-2">Status</th>
            <th className="px-4 py-2">ERP order</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders?.map((o) => (
            <tr key={o.id}>
              <td className="px-4 py-2">{new Date(o.createdAt).toLocaleString()}</td>
              <td className="px-4 py-2 font-medium text-slate-800">{o.tenant.name}</td>
              <td className="px-4 py-2 text-slate-500">{o.user?.name ?? o.poNumber ?? "—"}</td>
              <td className="px-4 py-2">{o.paymentMethod}</td>
              <td className="px-4 py-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs ${
                    o.status === "submitted"
                      ? "bg-emerald-50 text-emerald-700"
                      : o.status === "error"
                        ? "bg-red-50 text-red-700"
                        : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {o.status}
                </span>
              </td>
              <td className="px-4 py-2 text-slate-500">{o.erpOrderId ?? "—"}</td>
              <td className="px-4 py-2 text-right">
                {o.status === "error" ? (
                  <button
                    className="text-blue-600 hover:underline"
                    onClick={async () => {
                      await api(`/api/admin/orders/${o.id}/retry`, { method: "POST" });
                      load();
                    }}
                  >
                    Retry ERP submit
                  </button>
                ) : null}
              </td>
            </tr>
          ))}
          {orders && orders.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                No orders yet
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </Shell>
  );
}
