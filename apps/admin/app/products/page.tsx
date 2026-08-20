"use client";

import { useEffect, useRef, useState } from "react";
import { Shell } from "@/components/Shell";
import { api, apiUpload, ApiError } from "@/lib/api";

interface Variant {
  sku: string;
  size: string;
  color: string;
  price: string;
  available: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string | null;
  imageUrl: string | null;
  variants: { id: string; sku: string; size: string | null; color: string | null; price: number }[];
}

const emptyVariant = (): Variant => ({ sku: "", size: "", color: "", price: "", available: "0" });

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [form, setForm] = useState({ sku: "", name: "", brand: "", imageUrl: "", description: "" });
  const [variants, setVariants] = useState<Variant[]>([emptyVariant()]);
  const [error, setError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<any>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  function load() {
    api<Product[]>("/api/admin/products").then(setProducts);
  }
  useEffect(load, []);

  async function createProduct(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api("/api/admin/products", {
        method: "POST",
        body: JSON.stringify({
          ...form,
          variants: variants
            .filter((v) => v.sku)
            .map((v) => ({ ...v, price: Number(v.price), available: Number(v.available) })),
        }),
      });
      setForm({ sku: "", name: "", brand: "", imageUrl: "", description: "" });
      setVariants([emptyVariant()]);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create product");
    }
  }

  async function importCsv(e: React.FormEvent) {
    e.preventDefault();
    const file = fileInput.current?.files?.[0];
    if (!file) return;
    const data = new FormData();
    data.append("file", file);
    const result = await apiUpload("/api/admin/products/import", data);
    setImportResult(result);
    load();
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">Products</h1>
      <p className="mb-6 text-slate-500">The master catalog synced from your ERP, plus manual and bulk-uploaded products.</p>

      <div className="mb-8 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-2">Name</th>
              <th className="px-4 py-2">SKU</th>
              <th className="px-4 py-2">Brand</th>
              <th className="px-4 py-2">Variants</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products?.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{p.name}</td>
                <td className="px-4 py-2 text-slate-500">{p.sku}</td>
                <td className="px-4 py-2">{p.brand ?? "—"}</td>
                <td className="px-4 py-2">{p.variants.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mb-8 grid max-w-2xl gap-3 rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-800">Bulk upload via CSV</h2>
        <p className="text-sm text-slate-500">
          Columns: <code>productSku, sku, name, description, brand, imageUrl, size, color, price, available</code>. One
          row per size/color variant.
        </p>
        <form onSubmit={importCsv} className="flex items-center gap-3">
          <input ref={fileInput} type="file" accept=".csv" className="text-sm" required />
          <button className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white">Import CSV</button>
        </form>
        {importResult ? (
          <pre className="whitespace-pre-wrap rounded bg-slate-50 p-3 text-xs text-slate-600">
            {JSON.stringify(importResult, null, 2)}
          </pre>
        ) : null}
      </div>

      <div className="max-w-2xl rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Add a single product</h2>
        <form onSubmit={createProduct} className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} required />
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Brand" value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} />
            <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Image URL" value={form.imageUrl} onChange={(e) => setForm({ ...form, imageUrl: e.target.value })} />
          </div>
          <textarea className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <h3 className="mt-2 text-sm font-medium text-slate-700">Variants (size/color/price)</h3>
          {variants.map((v, i) => (
            <div key={i} className="grid grid-cols-5 gap-2">
              <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Variant SKU" value={v.sku} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, sku: e.target.value } : x)))} />
              <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Size" value={v.size} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, size: e.target.value } : x)))} />
              <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Color" value={v.color} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, color: e.target.value } : x)))} />
              <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Price" value={v.price} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, price: e.target.value } : x)))} />
              <input className="rounded border border-slate-300 px-2 py-1 text-sm" placeholder="Available" value={v.available} onChange={(e) => setVariants(variants.map((x, idx) => (idx === i ? { ...x, available: e.target.value } : x)))} />
            </div>
          ))}
          <button type="button" className="w-fit text-sm text-blue-600" onClick={() => setVariants([...variants, emptyVariant()])}>
            + Add variant
          </button>

          <button className="w-fit rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">Create product</button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </form>
      </div>
    </Shell>
  );
}
