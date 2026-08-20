import StorePage from "@/app/store/[slug]/[[...path]]/page";

export const dynamic = "force-dynamic";

export default function SignatureSitePage({
  params,
  searchParams,
}: {
  params: { slug: string; path?: string[] };
  searchParams: { punchout?: string };
}) {
  return StorePage({ params, searchParams });
}
