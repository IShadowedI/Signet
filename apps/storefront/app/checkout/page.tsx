import { headers } from "next/headers";
import { fetchStorefront } from "@/lib/api";
import { resolveTenantSlug } from "@/lib/tenant";
import { CheckoutView } from "@/components/CheckoutView";

export const dynamic = "force-dynamic";

export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: { tenant?: string | string[]; punchout?: string };
}) {
  const host = headers().get("host");
  const slug = resolveTenantSlug(host, searchParams.tenant);
  const data = await fetchStorefront(slug);
  const accent = data?.tenant.accentColor ?? "#1d4ed8";
  const tenantName = data?.tenant.name ?? slug;

  return <CheckoutView slug={slug} accent={accent} tenantName={tenantName} punchoutToken={searchParams.punchout} />;
}
