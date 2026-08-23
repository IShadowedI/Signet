"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { ApiError, BuyerMe, fetchBuyerMe, submitOrder, submitPunchoutReturn, track } from "@/lib/api";

export function CheckoutView({
  slug,
  accent,
  tenantName,
  punchoutToken,
}: {
  slug: string;
  accent: string;
  tenantName: string;
  punchoutToken?: string;
}) {
  const { lines, total, clear } = useCart(slug);
  const [me, setMe] = useState<BuyerMe | null>(null);
  const [meChecked, setMeChecked] = useState(false);
  const [poNumber, setPoNumber] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"po" | "allotment">("po");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ status: string; erpOrderId?: string | null } | null>(null);

  useEffect(() => {
    fetchBuyerMe(slug)
      .then(setMe)
      .finally(() => setMeChecked(true));
  }, [slug]);

  const allEligibleForAllotment = lines.length > 0 && lines.every((l) => l.allotmentEligible);
  const shopHref = punchoutToken ? `/?tenant=${slug}&punchout=${punchoutToken}` : `/?tenant=${slug}`;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (paymentMethod === "allotment") {
      if (!me) return setError("Sign in with your company account to pay with your uniform allotment.");
      if (me.allotmentBalance < total) return setError("Your allotment balance is insufficient for this order.");
    }

    setBusy(true);
    try {
      if (punchoutToken) {
        await submitPunchoutReturn(
          punchoutToken,
          lines.map((l) => ({ sku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice, description: l.name })),
        );
        setResult({ status: "returned" });
      } else {
        const order = await submitOrder(slug, {
          lines: lines.map((l) => ({ variantSku: l.sku, quantity: l.quantity, unitPrice: l.unitPrice })),
          poNumber: poNumber || undefined,
          paymentMethod,
        });
        lines.forEach((l) => track(slug, { type: "purchase", productId: l.productId }));
        setResult({ status: order.status, erpOrderId: order.erpOrderId });
      }
      clear();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Checkout failed. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  if (result) {
    return (
      <main className="mx-auto max-w-xl px-8 py-16 text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">
          {punchoutToken ? "Cart returned to your procurement system" : "Order submitted"}
        </h1>
        <p className="mb-6 text-slate-600">
          {punchoutToken
            ? "Your selections have been sent back to complete your requisition."
            : `Status: ${result.status}${result.erpOrderId ? ` · ERP order ${result.erpOrderId}` : ""}`}
        </p>
        <Link href={shopHref} className="text-sm underline">
          Back to {tenantName}
        </Link>
      </main>
    );
  }

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-xl p-10 text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <Link href={shopHref} className="text-sm underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#faf8f5] px-3 py-3 text-slate-800 md:px-8 md:py-6">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-orange-100/40">
        <header className="flex items-center justify-between px-6 py-5"><Link href={shopHref} className="text-2xl font-bold tracking-wide text-orange-500">SIGNET</Link><span className="text-sm font-medium">{tenantName} Store</span></header>
        <div className="bg-gradient-to-r from-orange-400 via-amber-400 to-orange-500 px-6 py-8"><div className="mx-auto max-w-2xl rounded-full bg-white/90 px-5 py-3 text-sm text-slate-500">Search products, SKUs, categories...</div></div>
        <div className="mx-4 grid grid-cols-4 divide-x divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white text-center text-xs font-medium shadow-sm md:mx-6"><span className="bg-orange-50 px-2 py-4 text-orange-600">1. Cart</span><span className="px-2 py-4 text-slate-500">2. Billing / Shipping</span><span className="px-2 py-4 text-slate-500">3. Payment</span><span className="px-2 py-4 text-slate-500">4. Order Placed</span></div>
      <div className="mx-auto max-w-5xl px-4 py-7 md:px-6">
      <h1 className="mb-5 text-2xl font-bold text-slate-900">Your cart</h1>

      {punchoutToken ? (
        <div className="mb-6 rounded bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Punchout session active — submitting will return this cart to your procurement system instead of placing an
          order directly.
        </div>
      ) : null}

      <div className="mb-6 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white shadow-sm">
        {lines.map((l) => (
          <div key={l.sku} className="flex items-center justify-between p-3 text-sm">
            <span>
              {l.name} {[l.color, l.size].filter(Boolean).join(" / ") ? `(${[l.color, l.size].filter(Boolean).join(" / ")})` : ""} × {l.quantity}
            </span>
            <span className="font-medium">${(l.unitPrice * l.quantity).toFixed(2)}</span>
          </div>
        ))}
        <div className="flex items-center justify-between p-3 text-sm font-semibold">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>
      </div>

      <section className="border-t border-orange-200 pt-6"><h2 className="mb-4 text-xl font-bold text-slate-900">Ready to Checkout?</h2><form onSubmit={submit} className="grid gap-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        {!punchoutToken && (
          <>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">PO number (optional)</span>
              <input
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                value={poNumber}
                onChange={(e) => setPoNumber(e.target.value)}
                placeholder="Purchase order / net-terms reference"
              />
            </label>

            <fieldset className="text-sm">
              <legend className="mb-1 font-medium text-slate-700">Payment method</legend>
              <label className="mr-4 inline-flex items-center gap-1">
                <input
                  type="radio"
                  checked={paymentMethod === "po"}
                  onChange={() => setPaymentMethod("po")}
                />
                PO / net terms
              </label>
              <label className="inline-flex items-center gap-1">
                <input
                  type="radio"
                  checked={paymentMethod === "allotment"}
                  onChange={() => setPaymentMethod("allotment")}
                  disabled={!allEligibleForAllotment}
                />
                Uniform allotment {me ? `(balance $${me.allotmentBalance.toFixed(2)})` : ""}
              </label>
              {!allEligibleForAllotment ? (
                <p className="mt-1 text-xs text-slate-400">
                  All items in your cart must be allotment-eligible to use this option.
                </p>
              ) : meChecked && !me ? (
                <p className="mt-1 text-xs text-slate-400">
                  <Link href={`/login?tenant=${slug}`} className="underline">
                    Sign in
                  </Link>{" "}
                  to pay with your uniform allotment.
                </p>
              ) : null}
            </fieldset>
          </>
        )}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          disabled={busy}
          className="rounded-lg bg-gradient-to-r from-orange-500 to-orange-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-orange-200 disabled:opacity-50"
        >
          {busy ? "Submitting…" : punchoutToken ? "Return cart to procurement" : "Place order"}
        </button>
      </form></section>
      <div className="mt-7 grid gap-3 border-t border-slate-100 pt-5 text-center text-sm text-slate-500 sm:grid-cols-4"><span>Secure Checkout</span><span>B2B Focused</span><span>ERP Integrated</span><span>Reliable Support</span></div>
      </div></div>
    </main>
  );
}
