import { headers } from "next/headers";
import { resolveTenantSlug } from "@/lib/tenant";
import { LoginForm } from "@/components/LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage({
  searchParams,
}: {
  searchParams: { tenant?: string | string[]; punchout?: string };
}) {
  const host = headers().get("host");
  const slug = resolveTenantSlug(host, searchParams.tenant);
  const qs = searchParams.punchout ? `?tenant=${slug}&punchout=${searchParams.punchout}` : `?tenant=${slug}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <LoginForm slug={slug} redirectTo={qs} />
    </div>
  );
}
