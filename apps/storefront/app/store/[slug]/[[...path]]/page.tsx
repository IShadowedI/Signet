import { notFound } from "next/navigation";
import { fetchPublishedSitePage, fetchStorefront } from "@/lib/api";
import { Header } from "@/components/Header";
import { ProductGrid } from "@/components/ProductGrid";

export const dynamic = "force-dynamic";

export default async function StorePage({
  params,
  searchParams,
}: {
  params: { slug: string; path?: string[] };
  searchParams: { punchout?: string };
}) {
  const sitePath = params.path?.length ? `/${params.path.join("/")}` : "/";
  const [savedPage, storefront] = await Promise.all([fetchPublishedSitePage(params.slug, sitePath), fetchStorefront(params.slug)]);
  if (!storefront) notFound();

  const themeVars = {
    ["--brand-primary" as string]: storefront.tenant.primaryColor,
    ["--brand-accent" as string]: storefront.tenant.accentColor,
  } as React.CSSProperties;

  if (savedPage) {
    const body = extractBody(savedPage.page.html);
    const html = rewriteInternalLinks(body, params.slug);
    return (
      <div style={themeVars}>
        <Header
          slug={params.slug}
          tenantName={storefront.tenant.name}
          logoUrl={storefront.tenant.logoUrl}
          primaryColor={storefront.tenant.primaryColor}
          accentColor={storefront.tenant.accentColor}
          punchoutToken={searchParams.punchout}
        />
        <style dangerouslySetInnerHTML={{ __html: savedPage.page.css }} />
        <main dangerouslySetInnerHTML={{ __html: html }} />
      </div>
    );
  }

  // A client can still start with the commerce catalog before publishing a custom page.
  if (sitePath !== "/") notFound();
  return (
    <div style={themeVars}>
      <Header
        slug={params.slug}
        tenantName={storefront.tenant.name}
        logoUrl={storefront.tenant.logoUrl}
        primaryColor={storefront.tenant.primaryColor}
        accentColor={storefront.tenant.accentColor}
        punchoutToken={searchParams.punchout}
      />
      <section className="px-8 py-16 text-white" style={{ background: `linear-gradient(135deg, ${storefront.tenant.primaryColor}, ${storefront.tenant.accentColor})` }}>
        <div className="mx-auto max-w-5xl">
          <h1 className="text-4xl font-bold">{storefront.tenant.heroHeadline}</h1>
          <p className="mt-3 text-lg opacity-90">{storefront.tenant.heroSubtext}</p>
        </div>
      </section>
      <main className="mx-auto max-w-6xl px-8 py-12">
        <h2 className="mb-6 text-xl font-semibold text-slate-800">Catalog</h2>
        <ProductGrid slug={params.slug} products={storefront.products} accent={storefront.tenant.accentColor} />
      </main>
    </div>
  );
}

function extractBody(html: string): string {
  const match = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html);
  return match?.[1] ?? html;
}

function rewriteInternalLinks(html: string, slug: string): string {
  return html.replace(/href=(["'])\/(?!store\/|\/)([^"']*)\1/gi, (_match, quote, target) => `href=${quote}/store/${slug}/${target}${quote}`);
}
