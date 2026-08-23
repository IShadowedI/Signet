import { notFound } from "next/navigation";
import { fetchPublishedSitePage, fetchStorefront } from "@/lib/api";
import { Header } from "@/components/Header";
import { ProductGrid } from "@/components/ProductGrid";
import { ProductDetail } from "@/components/ProductDetail";

export const dynamic = "force-dynamic";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

  const productId = params.path?.[0] === "product" ? params.path[1] : null;
  if (productId) {
    const product = storefront.products.find((item) => item.id === productId);
    if (!product) notFound();
    // If the client published a custom product template page, render it and let
    // the universal commerce runtime hydrate it for this product id.
    const productPage = await fetchPublishedSitePage(params.slug, "/product");
    if (productPage) {
      const document = buildCustomDocument(productPage.page, params.slug);
      return <iframe title={product.name} srcDoc={document} className="block h-screen w-full border-0" />;
    }
    return <div style={themeVars}><Header slug={params.slug} tenantName={storefront.tenant.name} logoUrl={storefront.tenant.logoUrl} primaryColor={storefront.tenant.primaryColor} accentColor={storefront.tenant.accentColor} punchoutToken={searchParams.punchout} /><ProductDetail slug={params.slug} product={product} accent={storefront.tenant.accentColor} /></div>;
  }

  if (savedPage) {
    const document = buildCustomDocument(savedPage.page, params.slug);
    return (
      <iframe
        title={savedPage.page.title}
        srcDoc={document}
        className="block h-screen w-full border-0"
      />
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

function rewriteInternalLinks(html: string, slug: string): string {
  return html.replace(/href=(["'])\/(?!store\/|\/)([^"']*)\1/gi, (_match, quote, target) => `href=${quote}/store/${slug}/${target}${quote}`);
}

function buildCustomDocument(page: { title: string; html: string; css: string; js: string }, slug: string): string {
  const html = rewriteInternalLinks(page.html, slug);
  const additions = `<base href="/store/${slug}/"><style>${page.css}</style>`;
  const pageScript = page.js ? `<script>${page.js.replace(/<\/script/gi, "<\\/script")}</script>` : "";
  // Universal commerce runtime injected into every client site + template.
  const config = JSON.stringify({ slug, apiBase: API_URL }).replace(/</g, "\\u003c");
  const runtime = `<script>window.__SIGNET__=${config}</script><script src="/signet-commerce.js" defer></script>`;
  const script = `${pageScript}${runtime}`;

  if (/<html[\s>]/i.test(html)) {
    const withHead = /<\/head>/i.test(html) ? html.replace(/<\/head>/i, `${additions}</head>`) : html.replace(/<html([^>]*)>/i, `<html$1><head><meta charset="utf-8">${additions}</head>`);
    return /<\/body>/i.test(withHead) ? withHead.replace(/<\/body>/i, `${script}</body>`) : `${withHead}${script}`;
  }

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${page.title}</title>${additions}</head><body>${html}${script}</body></html>`;
}
