"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ApiError, buyerLogin } from "@/lib/api";

export function LoginForm({ slug, redirectTo }: { slug: string; redirectTo: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await buyerLogin(slug, email, password);
      router.replace(redirectTo);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="mb-1 text-xl font-bold text-slate-900">Sign in</h1>
      <p className="mb-6 text-sm text-slate-500">Access your company store, order history, and uniform allotment.</p>

      <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
      <input
        className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        type="email"
        required
      />

      <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
      <input
        className="mb-4 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        type="password"
        required
      />

      {error ? <p className="mb-4 text-sm text-red-600">{error}</p> : null}

      <button
        disabled={busy}
        className="w-full rounded bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
