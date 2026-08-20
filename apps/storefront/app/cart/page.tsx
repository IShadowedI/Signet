import { headers } from "next/headers";
import { fetchStorefront } from "@/lib/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { CartView } from "@/components/CartView";

export const dynamic = "force-dynamic";

export default async function CartPage({
  searchParams,
}: {
  searchParams: { tenant?: string | string[]; punchout?: string };
}) {
  const host = headers().get("host");
  const slug = resolveTenantSlug(host, searchParams.tenant);
  const data = await fetchStorefront(slug);
  const accent = data?.tenant.accentColor ?? "#1d4ed8";

  return <CartView slug={slug} accent={accent} punchoutToken={searchParams.punchout} />;
}
