"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { api, ApiError } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/internal/login", { method: "POST", body: JSON.stringify({ username, password }) });
      const me = await api<{ role: string; tenant: { slug: string } | null }>("/api/auth/internal/me");
      window.location.assign(`/dashboard/${me.role === "owner" ? "signet-owner" : me.tenant?.slug ?? "company"}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#f4f1ee] p-4 md:p-7">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-[1500px] overflow-hidden rounded-[28px] border border-white/80 bg-white/55 shadow-xl shadow-slate-300/40 lg:grid-cols-2">
        <section className="hidden flex-col justify-center px-20 py-16 lg:flex">
          <img src="/dashboard/assets/signet-logo.png" alt="Signet" className="mb-14 w-80" />
          <h1 className="text-5xl font-bold leading-tight text-slate-800">Connect. Automate.<br />Grow Together.</h1>
          <p className="mt-5 max-w-md text-xl leading-relaxed text-slate-600">Signet bridges your eCommerce platforms and ERPs to streamline operations and empower your business.</p>
          <div className="mt-10 space-y-7 text-slate-700"><Info title="Unified Integrations" text="Connect your store, ERP, and partners in one seamless platform." /><Info title="Real-Time Sync" text="Keep inventory, orders, and data in perfect sync across systems." /><Info title="Built for B2B" text="Secure, scalable, and designed for growing businesses." /></div>
        </section>
        <div className="flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-slate-50 p-5 md:p-12">
          <form onSubmit={onSubmit} className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white/90 p-8 shadow-2xl shadow-slate-300/40 md:p-16">
            <img src="/dashboard/assets/signet-logo.png" alt="Signet" className="mb-8 w-48 lg:hidden" />
            <h1 className="text-center text-3xl font-bold text-slate-900">Welcome Back</h1><p className="mb-9 mt-2 text-center text-slate-600">Sign in to access your Signet dashboard</p>

        <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
        <input
          className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-4 text-sm shadow-sm"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          required
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          className="mb-5 w-full rounded-xl border border-slate-200 px-4 py-4 text-sm shadow-sm"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

        <button
          disabled={busy}
          className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-3 py-4 text-lg font-semibold text-white shadow-lg shadow-orange-200 disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <Link href="/owner/login" className="mt-5 block text-center text-sm text-orange-600 hover:underline">
          Signet Owner sign in
        </Link>
          </form>
        </div>
      </div>
    </div>
  );
}

function Info({ title, text }: { title: string; text: string }) { return <div><h2 className="text-xl font-bold">{title}</h2><p className="mt-1 max-w-sm text-lg text-slate-600">{text}</p></div>; }
