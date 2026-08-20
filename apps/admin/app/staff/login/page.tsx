"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, ApiError } from "@/lib/api";

interface Company {
  slug: string;
  name: string;
}

export default function StaffLoginPage() {
  const router = useRouter();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companySlug, setCompanySlug] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api<Company[]>("/api/auth/internal/companies").then((rows) => {
      setCompanies(rows);
      const signature = rows.find((row) => row.slug === "signature-imagewear");
      setCompanySlug(signature?.slug ?? rows[0]?.slug ?? "");
    });
  }, []);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api("/api/auth/internal/staff-login", { method: "POST", body: JSON.stringify({ username, password, companySlug }) });
      router.replace("/");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-bold text-slate-900">Company Staff Sign In</h1>
        <p className="mb-5 text-sm text-slate-500">Choose your company, then use your staff username and password.</p>

        <button
          type="button"
          className="mb-3 flex w-full items-center justify-between rounded border border-slate-300 px-3 py-2 text-left text-sm"
          onClick={() => setExpanded((open) => !open)}
        >
          <span>{companies.find((company) => company.slug === companySlug)?.name ?? "Choose company"}</span>
          <span>{expanded ? "⌃" : "⌄"}</span>
        </button>
        {expanded ? (
          <div className="mb-4 max-h-40 overflow-auto rounded border border-slate-200 p-1">
            {companies.map((company) => (
              <button
                key={company.slug}
                type="button"
                className={`block w-full rounded px-2 py-2 text-left text-sm ${company.slug === companySlug ? "bg-slate-100" : "hover:bg-slate-50"}`}
                onClick={() => { setCompanySlug(company.slug); setExpanded(false); }}
              >
                {company.name}
              </button>
            ))}
          </div>
        ) : null}

        <label className="mb-1 block text-sm font-medium text-slate-700">Username</label>
        <input className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm" value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" required />
        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm" value={password} onChange={(event) => setPassword(event.target.value)} type="password" autoComplete="current-password" required />
        {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}
        <button disabled={busy} className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">
          {busy ? "Signing in…" : "Sign in"}
        </button>
        <Link href="/login" className="mt-4 block text-center text-sm text-indigo-600 hover:underline">Signet owner sign in</Link>
      </form>
    </div>
  );
}
