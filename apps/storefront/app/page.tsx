import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { fetchStorefront } from "@/lib/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { Header } from "@/components/Header";
import { ProductGrid } from "@/components/ProductGrid";

export const dynamic = "force-dynamic";

export default async function Home({
  searchParams,
}: {
  searchParams: { tenant?: string | string[]; punchout?: string };
}) {
  if (typeof searchParams.tenant === "string") {
    const punchout = searchParams.punchout ? `?punchout=${encodeURIComponent(searchParams.punchout)}` : "";
    redirect(`/store/${encodeURIComponent(searchParams.tenant)}${punchout}`);
  }

  const host = headers().get("host");
  const slug = resolveTenantSlug(host, searchParams.tenant);
  const data = await fetchStorefront(slug);

  if (!data) {
    return (
      <main className="mx-auto max-w-2xl p-10">
        <h1 className="text-2xl font-bold">Storefront not found</h1>
        <p className="mt-2 text-slate-600">
          No storefront is configured for <code>{slug}</code>. Try{" "}
          <a className="underline" href="/?tenant=ford">
            ?tenant=ford
          </a>{" "}
          or <a className="underline" href="/?tenant=acme">?tenant=acme</a>.
        </p>
        <p className="mt-2 text-sm text-slate-500">
          Is the API running on {process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}?
        </p>
      </main>
    );
  }

  const { tenant, products } = data;
  const themeVars = {
    ["--brand-primary" as string]: tenant.primaryColor,
    ["--brand-accent" as string]: tenant.accentColor,
  } as React.CSSProperties;
  const punchoutToken = searchParams.punchout;

  return (
    <div style={themeVars}>
      <Header
        slug={slug}
        tenantName={tenant.name}
        logoUrl={tenant.logoUrl}
        primaryColor={tenant.primaryColor}
        accentColor={tenant.accentColor}
        punchoutToken={punchoutToken}
      />

      {punchoutToken ? (
        <div className="bg-amber-50 px-8 py-2 text-center text-sm text-amber-800">
          You're shopping via your procurement system's punchout session. Add items to your cart, then return them to
          continue your requisition.
        </div>
      ) : null}

      {/* Hero */}
      <section
        className="px-8 py-16 text-white"
        style={{
          background: `linear-gradient(135deg, ${tenant.primaryColor}, ${tenant.accentColor})`,
        }}
      >
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold tracking-tight">{tenant.heroHeadline}</h1>
          <p className="mt-3 max-w-2xl text-lg opacity-90">{tenant.heroSubtext}</p>
        </div>
      </section>

      {/* Product grid */}
      <main id="products" className="mx-auto max-w-6xl px-8 py-12">
        <h2 className="mb-6 text-xl font-semibold text-slate-800">Catalog</h2>
        <ProductGrid slug={slug} products={products} accent={tenant.accentColor} />
      </main>

      <footer className="border-t border-slate-200 px-8 py-6 text-center text-sm text-slate-500">
        Powered by Signet · storefront: <code>{tenant.slug}</code>
      </footer>
    </div>
  );
}
