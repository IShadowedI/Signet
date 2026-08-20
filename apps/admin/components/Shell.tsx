"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";

interface Me {
  id: string;
  email: string;
  name: string;
  role: string;
}

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "home.png" },
  { href: "/tenants", label: "Client Sites", icon: "client-sites.png" },
  { href: "/products", label: "Products", icon: "products.png" },
  { href: "/orders", label: "Orders", icon: "orders.png" },
  { href: "/quotes", label: "Quotes", icon: "quotes.png" },
  { href: "/returns", label: "Returns & Requests", icon: "returns+requests.png" },
  { href: "/shipments", label: "Shipments", icon: "shipments.png" },
  { href: "/invoices", label: "Invoices", icon: "invoice.png", separatorBefore: true, separatorAfter: true },
  { href: "/sites", label: "Site Builder", icon: "site-builder.png", active: false },
  { href: "/sites", label: "Ongoing Sites", icon: "ongoing-sites.png" },
  { href: "/templates", label: "Template Gallery", icon: "template-gallery.png" },
];

/** Wraps every protected admin page: verifies the session and renders the sidebar shell. */
export function Shell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<Me | null>(null);
  const [checked, setChecked] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    api<Me>("/api/auth/internal/me")
      .then(setMe)
      .catch(() => router.replace("/login"))
      .finally(() => setChecked(true));
  }, [router]);

  useEffect(() => {
    const saved = window.localStorage.getItem("signet-theme") === "dark";
    setDarkMode(saved);
    document.documentElement.dataset.theme = saved ? "dark" : "light";
  }, []);

  function setTheme(enabled: boolean) {
    setDarkMode(enabled);
    window.localStorage.setItem("signet-theme", enabled ? "dark" : "light");
    document.documentElement.dataset.theme = enabled ? "dark" : "light";
  }

  if (!checked) return <div className="p-8 text-slate-500">Loading…</div>;
  if (!me) return null;

  return (
    <div className="min-h-screen text-[color:var(--ink)]">
      <header className="fixed inset-x-0 top-0 z-20 flex h-24 items-center gap-6 px-8">
        <Link href="/" className="flex w-60 items-center">
          <img src="/assets/signet-logo.png" alt="Signet" className="h-auto w-48" />
        </Link>
        <div className="skeuo-inset flex max-w-4xl flex-1 items-center gap-3 rounded-2xl px-5 py-3 text-[color:var(--muted)]">
          <span className="text-2xl leading-none">⌕</span>
          <input
            className="w-full bg-transparent text-sm outline-none placeholder:text-[color:var(--muted)]"
            placeholder="Search clients, orders, invoices..."
          />
        </div>
        <button className="skeuo-button relative grid h-14 w-14 place-items-center rounded-full text-xl" aria-label="Notifications">
          🔔
          <span className="absolute right-1 top-0 grid h-5 w-5 place-items-center rounded-full bg-orange-500 text-[10px] font-bold text-white">3</span>
        </button>
        <div className="relative">
          <button
            className="skeuo-button flex items-center gap-3 rounded-3xl px-3 py-2 text-left"
            onClick={() => setSettingsOpen((open) => !open)}
            aria-expanded={settingsOpen}
          >
            <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-orange-600 font-bold text-white">{me.name.slice(0, 2).toUpperCase()}</span>
            <span className="hidden sm:block">
              <span className="block text-sm font-bold">{me.name}</span>
              <span className="block text-xs text-[color:var(--muted)]">{me.role}</span>
            </span>
            <span className="text-sm">⌄</span>
          </button>
          {settingsOpen ? (
            <div className="skeuo-panel absolute right-0 top-[calc(100%+0.75rem)] w-64 rounded-2xl p-3 text-sm">
              <div className="mb-2 border-b border-[color:var(--line)] px-2 pb-2 text-xs text-[color:var(--muted)]">Settings</div>
              <label className="flex cursor-pointer items-center justify-between rounded-xl px-2 py-2 hover:bg-white/30">
                <span>Dark mode</span>
                <input type="checkbox" checked={darkMode} onChange={(e) => setTheme(e.target.checked)} className="h-4 w-4 accent-orange-500" />
              </label>
              <button
                className="mt-1 w-full rounded-xl px-2 py-2 text-left text-red-600 hover:bg-red-50/50"
                onClick={async () => {
                  await api("/api/auth/internal/logout", { method: "POST" });
                  router.replace("/login");
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </header>
      <aside className="skeuo-panel fixed bottom-7 left-6 top-24 z-10 flex w-64 flex-col rounded-[28px] p-3">
        <nav className="flex min-h-0 flex-1 flex-col justify-between">
          <div className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const selected = item.active !== false && pathname === item.href;
              return (
                <div key={item.label}>
                  {item.separatorBefore ? <div className="mx-2 my-2 border-t border-[color:var(--line)]" /> : null}
                  <Link
                    href={item.href}
                    className={`nav-item flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium transition-all ${
                      selected ? "skeuo-orange text-white" : "text-[color:var(--ink)] hover:bg-white/30"
                    }`}
                  >
                    <span aria-hidden className="nav-icon skeuo-button grid h-8 w-8 shrink-0 place-items-center rounded-xl">
                      <img src={`/assets/icons/${item.icon}`} alt="" className="h-5 w-5 object-contain" />
                    </span>
                    <span>{item.label}</span>
                  </Link>
                  {item.separatorAfter ? <div className="mx-2 my-2 border-t border-[color:var(--line)]" /> : null}
                </div>
              );
            })}
          </div>
          <button
            className="nav-item skeuo-button flex items-center gap-3 rounded-2xl px-3 py-2 text-sm font-medium text-[color:var(--ink)]"
            onClick={async () => {
              await api("/api/auth/internal/logout", { method: "POST" });
              router.replace("/login");
            }}
          >
            <span className="nav-icon grid h-8 w-8 place-items-center rounded-xl text-orange-500">⇥</span>
            Sign Out
          </button>
        </nav>
      </aside>
      <main className="min-h-screen pl-[19rem] pr-8 pt-28">{children}</main>
    </div>
  );
}
