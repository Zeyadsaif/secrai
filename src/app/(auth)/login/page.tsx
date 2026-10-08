"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.push("/dashboard/overview");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-bold text-[#0a1024]">S</div>
        <span className="font-display text-xl font-bold">Secrai</span>
      </div>
      <h1 className="font-display text-2xl font-bold">Welcome back</h1>
      <p className="mb-6 mt-1 text-sm text-white/50">Log in to your security workspace.</p>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <input className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
          type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
          type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        {error && <p className="text-sm text-sev-critical">{error}</p>}
        <button className="btn btn-primary justify-center" disabled={loading}>
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>
      <p className="mt-5 text-center text-sm text-white/50">
        No account? <Link href="/signup" className="text-brand-ink">Create one</Link>
      </p>
    </main>
  );
}
