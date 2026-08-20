"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart";

export function CartView({ slug, accent, punchoutToken }: { slug: string; accent: string; punchoutToken?: string }) {
  const { lines, updateQuantity, remove, total } = useCart(slug);
  const checkoutHref = punchoutToken ? `/checkout?tenant=${slug}&punchout=${punchoutToken}` : `/checkout?tenant=${slug}`;
  const shopHref = punchoutToken ? `/?tenant=${slug}&punchout=${punchoutToken}` : `/?tenant=${slug}`;

  if (lines.length === 0) {
    return (
      <main className="mx-auto max-w-2xl p-10 text-center">
        <h1 className="mb-2 text-2xl font-bold text-slate-900">Your cart is empty</h1>
        <Link href={shopHref} className="text-sm underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-8 py-10">
      <h1 className="mb-6 text-2xl font-bold text-slate-900">Your cart</h1>

      <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
        {lines.map((l) => (
          <div key={l.sku} className="flex items-center gap-4 p-4">
            {l.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={l.imageUrl} alt={l.name} className="h-16 w-16 rounded object-cover" />
            ) : (
              <div className="h-16 w-16 rounded bg-slate-100" />
            )}
            <div className="flex-1">
              <p className="font-medium text-slate-800">{l.name}</p>
              <p className="text-xs text-slate-500">
                {[l.color, l.size].filter(Boolean).join(" / ") || l.sku}
                {l.allotmentEligible ? <span className="ml-2 text-emerald-600">Allotment eligible</span> : null}
              </p>
              <p className="text-sm text-slate-600">${l.unitPrice.toFixed(2)} each</p>
            </div>
            <input
              type="number"
              min={0}
              className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
              value={l.quantity}
              onChange={(e) => updateQuantity(l.sku, Number(e.target.value))}
            />
            <span className="w-20 text-right font-medium text-slate-800">${(l.unitPrice * l.quantity).toFixed(2)}</span>
            <button className="text-sm text-red-600 hover:underline" onClick={() => remove(l.sku)}>
              Remove
            </button>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Link href={shopHref} className="text-sm underline">
          Continue shopping
        </Link>
        <div className="text-right">
          <p className="text-sm text-slate-500">Subtotal</p>
          <p className="text-xl font-bold text-slate-900">${total.toFixed(2)}</p>
        </div>
      </div>

      <Link
        href={checkoutHref}
        className="mt-6 block w-full rounded px-4 py-3 text-center text-sm font-semibold text-white"
        style={{ backgroundColor: accent }}
      >
        Proceed to checkout
      </Link>
    </main>
  );
}
