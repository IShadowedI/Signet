"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useCart } from "@/lib/cart";
import { BuyerMe, buyerLogout, fetchBuyerMe } from "@/lib/api";

export function Header({
  slug,
  tenantName,
  logoUrl,
  primaryColor,
  accentColor,
  punchoutToken,
}: {
  slug: string;
  tenantName: string;
  logoUrl?: string;
  primaryColor: string;
  accentColor: string;
  punchoutToken?: string;
}) {
  const { count } = useCart(slug);
  const [me, setMe] = useState<BuyerMe | null>(null);

  useEffect(() => {
    fetchBuyerMe(slug).then(setMe);
  }, [slug]);

  const qs = punchoutToken ? `?tenant=${slug}&punchout=${punchoutToken}` : `?tenant=${slug}`;
  const homeHref = `/store/${encodeURIComponent(slug)}${punchoutToken ? `?punchout=${encodeURIComponent(punchoutToken)}` : ""}`;

  return (
    <header className="flex items-center justify-between px-8 py-4 text-white" style={{ backgroundColor: primaryColor }}>
      <div className="flex items-center gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt={tenantName} className="h-8 rounded" />
        ) : null}
        <Link href={homeHref} className="text-lg font-semibold">
          {tenantName}
        </Link>
      </div>
      <nav className="flex items-center gap-4 text-sm">
        <a href="#products" className="opacity-90 hover:opacity-100">
          Shop
        </a>
        <Link href={`/cart${qs}`} className="opacity-90 hover:opacity-100">
          Cart{count > 0 ? ` (${count})` : ""}
        </Link>
        {me ? (
          <button
            className="rounded px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: accentColor }}
            onClick={async () => {
              await buyerLogout(slug);
              setMe(null);
            }}
          >
            Sign out ({me.name.split(" ")[0]})
          </button>
        ) : (
          <Link
            href={`/login?tenant=${slug}`}
            className="rounded px-3 py-1 text-sm font-medium"
            style={{ backgroundColor: accentColor }}
          >
            Sign in
          </Link>
        )}
      </nav>
    </header>
  );
}
