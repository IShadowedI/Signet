"use client";

import { useState } from "react";
import { StorefrontProduct } from "@/lib/api";
import { useCart } from "@/lib/cart";
import { track } from "@/lib/api";

export function ProductGrid({
  slug,
  products,
  accent,
}: {
  slug: string;
  products: StorefrontProduct[];
  accent: string;
}) {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {products.map((p) => (
        <ProductCard key={p.id} slug={slug} product={p} accent={accent} />
      ))}
    </div>
  );
}

function ProductCard({ slug, product, accent }: { slug: string; product: StorefrontProduct; accent: string }) {
  const { add } = useCart(slug);
  const colors = Array.from(new Set(product.variants.map((v) => v.color).filter(Boolean))) as string[];
  const sizes = Array.from(new Set(product.variants.map((v) => v.size).filter(Boolean))) as string[];
  const [color, setColor] = useState(colors[0] ?? "");
  const [size, setSize] = useState(sizes[0] ?? "");
  const [added, setAdded] = useState(false);

  const variant =
    product.variants.find((v) => (color ? v.color === color : true) && (size ? v.size === size : true)) ??
    product.variants[0];

  function addToCart() {
    if (!variant) return;
    add({
      sku: variant.sku,
      productId: product.id,
      name: product.name,
      size: variant.size,
      color: variant.color,
      unitPrice: variant.price,
      quantity: 1,
      imageUrl: product.imageUrl,
      allotmentEligible: product.allotmentEligible,
    });
    track(slug, { type: "add_to_cart", productId: product.id });
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  }

  return (
    <article className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      {product.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.imageUrl} alt={product.name} className="h-56 w-full object-cover" />
      ) : (
        <div className="h-56 w-full bg-slate-100" />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-slate-800">{product.name}</h3>
            {product.brand ? <p className="text-xs uppercase tracking-wide text-slate-400">{product.brand}</p> : null}
          </div>
          {product.allotmentEligible ? (
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Allotment</span>
          ) : null}
        </div>

        {product.description ? <p className="mt-2 line-clamp-2 text-sm text-slate-600">{product.description}</p> : null}

        {colors.length > 0 || sizes.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {colors.length > 0 ? (
              <select
                className="rounded border border-slate-200 px-2 py-1"
                value={color}
                onChange={(e) => setColor(e.target.value)}
              >
                {colors.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : null}
            {sizes.length > 0 ? (
              <select
                className="rounded border border-slate-200 px-2 py-1"
                value={size}
                onChange={(e) => setSize(e.target.value)}
              >
                {sizes.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            ) : null}
          </div>
        ) : null}

        <div className="mt-4 flex items-center justify-between">
          <span className="text-lg font-bold text-slate-900">${(variant?.price ?? product.fromPrice).toFixed(2)}</span>
          <button
            className="rounded px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: accent }}
            disabled={!variant}
            onClick={addToCart}
          >
            {added ? "Added ✓" : "Add to cart"}
          </button>
        </div>
      </div>
    </article>
  );
}
