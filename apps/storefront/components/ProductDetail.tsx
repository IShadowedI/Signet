"use client";

import Link from "next/link";
import { useState } from "react";
import { StorefrontProduct, track } from "@/lib/api";
import { useCart } from "@/lib/cart";

export function ProductDetail({ slug, product, accent }: { slug: string; product: StorefrontProduct; accent: string }) {
  const { add } = useCart(slug);
  const colors = Array.from(new Set(product.variants.map((variant) => variant.color).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(product.variants.map((variant) => variant.size).filter(Boolean))) as string[];
  const [color, setColor] = useState(colors[0] ?? "");
  const [size, setSize] = useState(sizes[0] ?? "");
  const variant = product.variants.find((item) => (!color || item.color === color) && (!size || item.size === size)) ?? product.variants[0];

  return <main className="mx-auto grid max-w-5xl gap-10 px-8 py-12 md:grid-cols-2">
    {product.imageUrl ? <img src={product.imageUrl} alt={product.name} className="w-full rounded-lg object-cover" /> : <div className="min-h-80 rounded-lg bg-slate-100" />}
    <div>
      <Link href={`/store/${slug}`} className="text-sm underline">Back to catalog</Link>
      <h1 className="mt-4 text-3xl font-bold text-slate-900">{product.name}</h1>
      {product.brand ? <p className="mt-1 text-sm uppercase tracking-wide text-slate-500">{product.brand}</p> : null}
      <p className="mt-5 text-slate-600">{product.description}</p>
      <div className="mt-6 flex gap-3">
        {colors.length ? <select className="rounded border border-slate-300 px-3 py-2" value={color} onChange={(event) => setColor(event.target.value)}>{colors.map((item) => <option key={item}>{item}</option>)}</select> : null}
        {sizes.length ? <select className="rounded border border-slate-300 px-3 py-2" value={size} onChange={(event) => setSize(event.target.value)}>{sizes.map((item) => <option key={item}>{item}</option>)}</select> : null}
      </div>
      <p className="mt-6 text-2xl font-bold">${(variant?.price ?? product.fromPrice).toFixed(2)}</p>
      <button className="mt-4 rounded px-4 py-2 font-medium text-white disabled:opacity-50" style={{ backgroundColor: accent }} disabled={!variant} onClick={() => { if (!variant) return; add({ sku: variant.sku, productId: product.id, name: product.name, size: variant.size, color: variant.color, unitPrice: variant.price, quantity: 1, imageUrl: product.imageUrl, allotmentEligible: product.allotmentEligible }); track(slug, { type: "add_to_cart", productId: product.id }); }}>Add to cart</button>
    </div>
  </main>;
}