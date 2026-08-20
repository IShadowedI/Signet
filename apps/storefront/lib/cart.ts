"use client";

import { useCallback, useEffect, useState } from "react";

export interface CartLine {
  sku: string;
  productId: string;
  name: string;
  size?: string;
  color?: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
  allotmentEligible: boolean;
}

function storageKey(slug: string) {
  return `signet_cart_${slug}`;
}

function readCart(slug: string): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(storageKey(slug));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeCart(slug: string, lines: CartLine[]) {
  window.localStorage.setItem(storageKey(slug), JSON.stringify(lines));
  // Notify other components on the same page (storage event only fires cross-tab).
  window.dispatchEvent(new CustomEvent("signet-cart-change", { detail: { slug } }));
}

/** Client-side cart backed by localStorage, scoped per tenant slug. */
export function useCart(slug: string) {
  const [lines, setLines] = useState<CartLine[]>([]);

  useEffect(() => {
    setLines(readCart(slug));
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail || detail.slug === slug) setLines(readCart(slug));
    };
    window.addEventListener("signet-cart-change", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("signet-cart-change", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, [slug]);

  const add = useCallback(
    (line: CartLine) => {
      const current = readCart(slug);
      const existing = current.find((l) => l.sku === line.sku);
      const next = existing
        ? current.map((l) => (l.sku === line.sku ? { ...l, quantity: l.quantity + line.quantity } : l))
        : [...current, line];
      writeCart(slug, next);
      setLines(next);
    },
    [slug],
  );

  const updateQuantity = useCallback(
    (sku: string, quantity: number) => {
      const current = readCart(slug);
      const next =
        quantity <= 0 ? current.filter((l) => l.sku !== sku) : current.map((l) => (l.sku === sku ? { ...l, quantity } : l));
      writeCart(slug, next);
      setLines(next);
    },
    [slug],
  );

  const remove = useCallback((sku: string) => updateQuantity(sku, 0), [updateQuantity]);

  const clear = useCallback(() => {
    writeCart(slug, []);
    setLines([]);
  }, [slug]);

  const total = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const count = lines.reduce((sum, l) => sum + l.quantity, 0);

  return { lines, add, remove, updateQuantity, clear, total, count };
}
