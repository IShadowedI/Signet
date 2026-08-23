"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api, apiUpload, ApiError } from "@/lib/api";

interface Tenant {
  id: string;
  slug: string;
  name: string;
  domain: string | null;
  erpCustomerCode: string | null;
  licenseKey: string | null;
  licenseStatus: string;
  licenseExpiresAt: string | null;
  primaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  heroHeadline: string;
  heroSubtext: string;
  pageBlocks: PageBlock[];
  punchoutEnabled: boolean;
  punchoutSharedSecret: string | null;
}

interface PageBlock {
  type: "hero" | "banner" | "richtext";
  title?: string;
  body?: string;
}

interface Product {
  id: string;
  sku: string;
  name: string;
}

interface TenantProductRow {
  id: string;
  productId: string;
  priceOverride: number | null;
  allotmentEligible: boolean;
  product: Product;
}

interface BuyerUser {
  id: string;
  email: string;
  name: string;
  role: string;
  allotmentBalance: number;
}

interface CrmData {
  contacts: { id: string; name: string; email: string | null; phone: string | null; title: string | null }[];
  addresses: { id: string; label: string | null; line1: string; city: string; state: string; postalCode: string }[];
  paymentMethods: { id: string; brand: string; last4: string }[];
  savedSearches: { id: string; query: string; createdAt: string }[];
  credentialRequests: { id: string; email: string; type: string; status: string; createdAt: string }[];
  searchLogs: { id: string; query: string; createdAt: string }[];
  productInteractions: { id: string; type: string; createdAt: string }[];
  pageViews: { id: string; path: string; createdAt: string }[];
}

interface Order {
  id: string;
  status: string;
  paymentMethod: string;
  erpOrderId: string | null;
  createdAt: string;
  tenant: { slug: string };
}

const TABS = ["Branding", "Catalog", "Users & Allotments", "CRM", "Orders", "ERP & Punchout"] as const;

export default function TenantDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Branding");
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [catalog, setCatalog] = useState<TenantProductRow[] | null>(null);
  const [allProducts, setAllProducts] = useState<Product[] | null>(null);
  const [buyers, setBuyers] = useState<BuyerUser[] | null>(null);
  const [crm, setCrm] = useState<CrmData | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  function loadAll() {
    api<Tenant>(`/api/admin/tenants/${slug}`).then(setTenant);
    api<TenantProductRow[]>(`/api/admin/catalog/${slug}`).then(setCatalog);
    api<Product[]>("/api/admin/products").then(setAllProducts);
    api<BuyerUser[]>(`/api/admin/users/${slug}`).then(setBuyers);
    api<CrmData>(`/api/admin/crm/${slug}`).then(setCrm);
    api<Order[]>("/api/admin/orders").then((rows) => setOrders(rows.filter((o) => o.tenant.slug === slug)));
  }

  useEffect(loadAll, [slug]);

  if (!tenant) {
    return (
      <Shell>
        <p className="text-slate-500">Loading…</p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mb-1 text-2xl font-bold text-slate-900">{tenant.name}</h1>
      <p className="mb-6 text-slate-500">
        Dashboard URL: /store/{tenant.slug} {tenant.domain ? `· ${tenant.domain}` : ""}
      </p>

      {notice ? <div className="mb-4 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{notice}</div> : null}

      <div className="mb-6 flex gap-2 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t ? "border-slate-900 text-slate-900" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Branding" && (
        <BrandingTab tenant={tenant} onSaved={(t) => { setTenant(t); setNotice("Saved."); }} />
      )}
      {tab === "Catalog" && catalog && allProducts && (
        <CatalogTab
          slug={slug}
          catalog={catalog}
          allProducts={allProducts}
          onChange={() => { loadAll(); setNotice("Catalog updated."); }}
        />
      )}
      {tab === "Users & Allotments" && buyers && (
        <UsersTab slug={slug} buyers={buyers} onChange={() => { loadAll(); setNotice("Updated."); }} />
      )}
      {tab === "CRM" && crm && <CrmTab slug={slug} crm={crm} onChange={loadAll} />}
      {tab === "Orders" && orders && <OrdersTab orders={orders} onChange={loadAll} />}
      {tab === "ERP & Punchout" && (
        <ErpTab slug={slug} tenant={tenant} onChange={(t) => { setTenant(t); setNotice("Updated."); }} />
      )}
    </Shell>
  );
}

// ---------------- Branding / page-builder ----------------

function BrandingTab({ tenant, onSaved }: { tenant: Tenant; onSaved: (t: Tenant) => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    domain: tenant.domain ?? "",
    erpCustomerCode: tenant.erpCustomerCode ?? "",
    licenseKey: tenant.licenseKey ?? "",
    licenseStatus: tenant.licenseStatus ?? "active",
    licenseExpiresAt: tenant.licenseExpiresAt ? tenant.licenseExpiresAt.slice(0, 10) : "",
    primaryColor: tenant.primaryColor,
    accentColor: tenant.accentColor,
    logoUrl: tenant.logoUrl ?? "",
    heroHeadline: tenant.heroHeadline,
    heroSubtext: tenant.heroSubtext,
  });
  const [blocks, setBlocks] = useState<PageBlock[]>(tenant.pageBlocks ?? []);

  async function save() {
    const updated = await api<Tenant>(`/api/admin/tenants/${tenant.slug}`, {
      method: "PATCH",
      body: JSON.stringify({ ...form, pageBlocks: blocks }),
    });
    onSaved(updated);
  }

  function addBlock(type: PageBlock["type"]) {
    setBlocks([...blocks, { type, title: "", body: "" }]);
  }

  return (
    <div className="grid max-w-3xl gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Branding</h2>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <Field label="Domain" value={form.domain} onChange={(v) => setForm({ ...form, domain: v })} />
          <Field
            label="ERP customer code"
            value={form.erpCustomerCode}
            onChange={(v) => setForm({ ...form, erpCustomerCode: v })}
          />
          <Field label="Logo URL" value={form.logoUrl} onChange={(v) => setForm({ ...form, logoUrl: v })} />
          <Field label="Primary color" type="color" value={form.primaryColor} onChange={(v) => setForm({ ...form, primaryColor: v })} />
          <Field label="Accent color" type="color" value={form.accentColor} onChange={(v) => setForm({ ...form, accentColor: v })} />
          <Field label="Hero headline" value={form.heroHeadline} onChange={(v) => setForm({ ...form, heroHeadline: v })} />
          <Field label="Hero subtext" value={form.heroSubtext} onChange={(v) => setForm({ ...form, heroSubtext: v })} />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-1 font-semibold text-slate-800">Custom domain &amp; license</h2>
        <p className="mb-4 text-xs text-slate-500">
          Point a client&apos;s own domain at this store and manage its store license. The domain also resolves the
          storefront just like the slug.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Custom domain" value={form.domain} onChange={(v) => setForm({ ...form, domain: v })} />
          <Field label="License key" value={form.licenseKey} onChange={(v) => setForm({ ...form, licenseKey: v })} />
          <label className="text-sm">
            <span className="mb-1 block text-slate-600">License status</span>
            <select
              className="w-full rounded border border-slate-300 px-3 py-2"
              value={form.licenseStatus}
              onChange={(e) => setForm({ ...form, licenseStatus: e.target.value })}
            >
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="expired">Expired</option>
            </select>
          </label>
          <Field
            label="License expires"
            type="date"
            value={form.licenseExpiresAt}
            onChange={(v) => setForm({ ...form, licenseExpiresAt: v })}
          />
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Homepage content blocks</h2>
          <div className="flex gap-2 text-sm">
            <button onClick={() => addBlock("banner")} className="rounded border border-slate-300 px-2 py-1">
              + Banner
            </button>
            <button onClick={() => addBlock("richtext")} className="rounded border border-slate-300 px-2 py-1">
              + Text block
            </button>
          </div>
        </div>
        {blocks.length === 0 ? <p className="text-sm text-slate-400">No extra blocks yet.</p> : null}
        <div className="flex flex-col gap-3">
          {blocks.map((b, i) => (
            <div key={i} className="rounded border border-slate-200 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium uppercase text-slate-400">{b.type}</span>
                <button
                  className="text-xs text-red-600"
                  onClick={() => setBlocks(blocks.filter((_, idx) => idx !== i))}
                >
                  Remove
                </button>
              </div>
              <input
                className="mb-2 w-full rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="Title"
                value={b.title ?? ""}
                onChange={(e) => setBlocks(blocks.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x)))}
              />
              <textarea
                className="w-full rounded border border-slate-300 px-2 py-1 text-sm"
                placeholder="Body text"
                value={b.body ?? ""}
                onChange={(e) => setBlocks(blocks.map((x, idx) => (idx === i ? { ...x, body: e.target.value } : x)))}
              />
            </div>
          ))}
        </div>
      </section>

      <button onClick={save} className="w-fit rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white">
        Save changes
      </button>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-slate-600">{label}</span>
      <input
        type={type}
        className="w-full rounded border border-slate-300 px-3 py-2"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}

// ---------------- Catalog ----------------

function CatalogTab({
  slug,
  catalog,
  allProducts,
  onChange,
}: {
  slug: string;
  catalog: TenantProductRow[];
  allProducts: Product[];
  onChange: () => void;
}) {
  const carriedIds = new Set(catalog.map((c) => c.productId));
  const [addProductId, setAddProductId] = useState("");
  const [importing, setImporting] = useState(false);

  async function addToCatalog() {
    if (!addProductId) return;
    await api(`/api/admin/catalog/${slug}`, { method: "POST", body: JSON.stringify({ productId: addProductId }) });
    setAddProductId("");
    onChange();
  }

  async function updateRow(row: TenantProductRow, patch: Partial<Pick<TenantProductRow, "priceOverride" | "allotmentEligible">>) {
    await api(`/api/admin/catalog/${slug}/${row.id}`, { method: "PATCH", body: JSON.stringify(patch) });
    onChange();
  }

  async function removeRow(row: TenantProductRow) {
    await api(`/api/admin/catalog/${slug}/${row.id}`, { method: "DELETE" });
    onChange();
  }

  async function importCatalog(file: File | null) {
    if (!file) return;
    setImporting(true);
    try {
      const data = new FormData();
      data.append("file", file);
      data.append("tenantSlug", slug);
      await apiUpload("/api/admin/products/import", data);
      onChange();
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-4 flex gap-2">
        <select
          className="rounded border border-slate-300 px-3 py-2 text-sm"
          value={addProductId}
          onChange={(e) => setAddProductId(e.target.value)}
        >
          <option value="">Add a product to this client's catalog…</option>
          {allProducts
            .filter((p) => !carriedIds.has(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sku})
              </option>
            ))}
        </select>
        <button onClick={addToCatalog} className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white">
          Add
        </button>
        <label className="cursor-pointer rounded border border-slate-300 px-3 py-2 text-sm">
          {importing ? "Importing..." : "Import CSV for this site"}
          <input type="file" accept=".csv,text/csv" className="hidden" disabled={importing} onChange={(e) => importCatalog(e.target.files?.[0] ?? null)} />
        </label>
      </div>

      <table className="w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Product</th>
            <th className="px-4 py-2">SKU</th>
            <th className="px-4 py-2">Price override</th>
            <th className="px-4 py-2">Allotment eligible</th>
            <th className="px-4 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {catalog.map((row) => (
            <tr key={row.id}>
              <td className="px-4 py-2 font-medium text-slate-800">{row.product.name}</td>
              <td className="px-4 py-2 text-slate-500">{row.product.sku}</td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  step="0.01"
                  className="w-24 rounded border border-slate-300 px-2 py-1"
                  defaultValue={row.priceOverride ?? ""}
                  placeholder="list price"
                  onBlur={(e) => updateRow(row, { priceOverride: e.target.value ? Number(e.target.value) : null })}
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="checkbox"
                  defaultChecked={row.allotmentEligible}
                  onChange={(e) => updateRow(row, { allotmentEligible: e.target.checked })}
                />
              </td>
              <td className="px-4 py-2 text-right">
                <button className="text-red-600 hover:underline" onClick={() => removeRow(row)}>
                  Remove
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------- Users & Allotments ----------------

function UsersTab({ slug, buyers, onChange }: { slug: string; buyers: BuyerUser[]; onChange: () => void }) {
  const [form, setForm] = useState({ email: "", name: "", allotmentBalance: "0", password: "" });
  const [adjust, setAdjust] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  async function createBuyer(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api(`/api/admin/users/${slug}`, {
        method: "POST",
        body: JSON.stringify({ ...form, allotmentBalance: Number(form.allotmentBalance) }),
      });
      setForm({ email: "", name: "", allotmentBalance: "0", password: "" });
      onChange();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed");
    }
  }

  async function grantAllotment(userId: string) {
    const amount = Number(adjust[userId] ?? 0);
    if (!amount) return;
    await api(`/api/admin/users/${slug}/${userId}/allotment`, {
      method: "POST",
      body: JSON.stringify({ amount, reason: "Manual admin adjustment" }),
    });
    setAdjust({ ...adjust, [userId]: "" });
    onChange();
  }

  return (
    <div className="max-w-3xl">
      <table className="mb-6 w-full overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
        <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
          <tr>
            <th className="px-4 py-2">Name</th>
            <th className="px-4 py-2">Email</th>
            <th className="px-4 py-2">Role</th>
            <th className="px-4 py-2">Allotment balance</th>
            <th className="px-4 py-2">Adjust</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {buyers.map((u) => (
            <tr key={u.id}>
              <td className="px-4 py-2 font-medium text-slate-800">{u.name}</td>
              <td className="px-4 py-2 text-slate-500">{u.email}</td>
              <td className="px-4 py-2">{u.role}</td>
              <td className="px-4 py-2">${u.allotmentBalance.toFixed(2)}</td>
              <td className="px-4 py-2">
                <div className="flex gap-1">
                  <input
                    type="number"
                    className="w-20 rounded border border-slate-300 px-2 py-1"
                    placeholder="+/-"
                    value={adjust[u.id] ?? ""}
                    onChange={(e) => setAdjust({ ...adjust, [u.id]: e.target.value })}
                  />
                  <button className="rounded border border-slate-300 px-2 py-1" onClick={() => grantAllotment(u.id)}>
                    Apply
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-4 font-semibold text-slate-800">Add a buyer</h2>
        <form onSubmit={createBuyer} className="grid grid-cols-2 gap-3">
          <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          <input className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Temporary password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
          <input type="number" className="rounded border border-slate-300 px-3 py-2 text-sm" placeholder="Starting allotment balance" value={form.allotmentBalance} onChange={(e) => setForm({ ...form, allotmentBalance: e.target.value })} />
          <button className="col-span-2 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white">Create buyer</button>
        </form>
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </div>
    </div>
  );
}

// ---------------- CRM ----------------

function CrmTab({ slug, crm, onChange }: { slug: string; crm: CrmData; onChange: () => void }) {
  return (
    <div className="grid max-w-4xl gap-6">
      <CrmSection title="Contacts">
        <ul className="divide-y divide-slate-100 text-sm">
          {crm.contacts.map((c) => (
            <li key={c.id} className="py-2">
              <span className="font-medium">{c.name}</span> — {c.title ?? "—"} · {c.email ?? "—"} · {c.phone ?? "—"}
            </li>
          ))}
          {crm.contacts.length === 0 && <li className="py-2 text-slate-400">None yet</li>}
        </ul>
      </CrmSection>

      <CrmSection title="Addresses">
        <ul className="divide-y divide-slate-100 text-sm">
          {crm.addresses.map((a) => (
            <li key={a.id} className="py-2">
              {a.label ? <span className="font-medium">{a.label}: </span> : null}
              {a.line1}, {a.city}, {a.state} {a.postalCode}
            </li>
          ))}
          {crm.addresses.length === 0 && <li className="py-2 text-slate-400">None yet</li>}
        </ul>
      </CrmSection>

      <CrmSection title="Credit cards on file (tokenized reference only)">
        <ul className="divide-y divide-slate-100 text-sm">
          {crm.paymentMethods.map((p) => (
            <li key={p.id} className="py-2">
              {p.brand} •••• {p.last4}
            </li>
          ))}
          {crm.paymentMethods.length === 0 && <li className="py-2 text-slate-400">None on file</li>}
        </ul>
      </CrmSection>

      <CrmSection title="Saved searches">
        <ul className="divide-y divide-slate-100 text-sm">
          {crm.savedSearches.map((s) => (
            <li key={s.id} className="py-2">
              "{s.query}" — {new Date(s.createdAt).toLocaleString()}
            </li>
          ))}
          {crm.savedSearches.length === 0 && <li className="py-2 text-slate-400">None yet</li>}
        </ul>
      </CrmSection>

      <CrmSection title="Username / password requests">
        <ul className="divide-y divide-slate-100 text-sm">
          {crm.credentialRequests.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2">
              <span>
                {r.email} — {r.type} ({r.status})
              </span>
              {r.status === "pending" ? (
                <button
                  className="text-blue-600 hover:underline"
                  onClick={async () => {
                    await api(`/api/admin/crm/${slug}/credential-requests/${r.id}/resolve`, { method: "POST" });
                    onChange();
                  }}
                >
                  Mark resolved
                </button>
              ) : null}
            </li>
          ))}
          {crm.credentialRequests.length === 0 && <li className="py-2 text-slate-400">None yet</li>}
        </ul>
      </CrmSection>

      <CrmSection title="Recent keyword searches">
        <ul className="flex flex-wrap gap-2 text-sm">
          {crm.searchLogs.slice(0, 30).map((s) => (
            <span key={s.id} className="rounded bg-slate-100 px-2 py-1">
              {s.query}
            </span>
          ))}
          {crm.searchLogs.length === 0 && <li className="text-slate-400">None yet</li>}
        </ul>
      </CrmSection>

      <div className="grid grid-cols-2 gap-6">
        <CrmSection title={`Website visits (${crm.pageViews.length})`}>
          <p className="text-sm text-slate-500">Latest: {crm.pageViews[0]?.path ?? "—"}</p>
        </CrmSection>
        <CrmSection title={`Product interactions (${crm.productInteractions.length})`}>
          <p className="text-sm text-slate-500">Latest type: {crm.productInteractions[0]?.type ?? "—"}</p>
        </CrmSection>
      </div>
    </div>
  );
}

function CrmSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6">
      <h2 className="mb-3 font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

// ---------------- Orders ----------------

function OrdersTab({ orders, onChange }: { orders: Order[]; onChange: () => void }) {
  return (
    <table className="w-full max-w-3xl overflow-hidden rounded-lg border border-slate-200 bg-white text-sm">
      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
        <tr>
          <th className="px-4 py-2">Date</th>
          <th className="px-4 py-2">Payment</th>
          <th className="px-4 py-2">Status</th>
          <th className="px-4 py-2">ERP order</th>
          <th className="px-4 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {orders.map((o) => (
          <tr key={o.id}>
            <td className="px-4 py-2">{new Date(o.createdAt).toLocaleString()}</td>
            <td className="px-4 py-2">{o.paymentMethod}</td>
            <td className="px-4 py-2">
              <span
                className={`rounded px-2 py-0.5 text-xs ${
                  o.status === "submitted" ? "bg-emerald-50 text-emerald-700" : o.status === "error" ? "bg-red-50 text-red-700" : "bg-slate-100 text-slate-600"
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
                    onChange();
                  }}
                >
                  Retry ERP submit
                </button>
              ) : null}
            </td>
          </tr>
        ))}
        {orders.length === 0 && (
          <tr>
            <td colSpan={5} className="px-4 py-6 text-center text-slate-400">
              No orders yet
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

// ---------------- ERP & Punchout ----------------

function ErpTab({ slug, tenant, onChange }: { slug: string; tenant: Tenant; onChange: (t: Tenant) => void }) {
  const [health, setHealth] = useState<{ provider: string; reachable: boolean } | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    api<{ provider: string; reachable: boolean }>("/api/admin/erp/health").then(setHealth);
  }, []);

  return (
    <div className="grid max-w-2xl gap-6">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-semibold text-slate-800">ERP connection</h2>
        <p className="text-sm text-slate-600">
          Active provider: <span className="font-medium">{health?.provider ?? "…"}</span> —{" "}
          {health?.reachable ? (
            <span className="text-emerald-600">reachable</span>
          ) : (
            <span className="text-red-600">unreachable</span>
          )}
        </p>
        <p className="mt-2 text-sm text-slate-600">Customer mapping: <span className="font-medium">{tenant.erpCustomerCode || "Not configured"}</span></p>
        <button
          className="mt-3 rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
          disabled={!health?.reachable || syncing}
          onClick={async () => {
            setSyncing(true);
            try {
              await api("/api/admin/erp/sync/products", { method: "POST", body: JSON.stringify({ tenantSlug: slug }) });
              onChange(await api<Tenant>(`/api/admin/tenants/${slug}`));
            } finally {
              setSyncing(false);
            }
          }}
        >
          {syncing ? "Syncing catalog..." : "Sync Acumatica catalog to this site"}
        </button>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <h2 className="mb-2 font-semibold text-slate-800">Punchout (cXML)</h2>
        {tenant.punchoutEnabled ? (
          <>
            <p className="mb-2 text-sm text-slate-600">Enabled. Shared secret (give to the buyer's procurement admin):</p>
            <code className="block break-all rounded bg-slate-100 p-2 text-xs">{tenant.punchoutSharedSecret}</code>
            <button
              className="mt-3 rounded border border-red-300 px-3 py-1.5 text-sm text-red-600"
              onClick={async () => onChange(await api<Tenant>(`/api/admin/tenants/${slug}/punchout/disable`, { method: "POST" }))}
            >
              Disable punchout
            </button>
          </>
        ) : (
          <button
            className="rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white"
            onClick={async () => onChange(await api<Tenant>(`/api/admin/tenants/${slug}/punchout/enable`, { method: "POST" }))}
          >
            Enable punchout for this client
          </button>
        )}
      </section>
    </div>
  );
}
