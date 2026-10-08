"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function SignupPage() {
  const router = useRouter();
  const [company, setCompany] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: name } },
    });
    if (error) { setLoading(false); return setError(error.message); }

    // Email confirmation may be required (no session yet).
    if (!data.session) {
      setLoading(false);
      return setNotice("Check your email to confirm your account, then log in to finish setup.");
    }

    // Bootstrap the org + owner membership + trial.
    const { error: rpcErr } = await supabase.rpc("create_organization" as never, { p_name: company } as never);
    setLoading(false);
    if (rpcErr) return setError(rpcErr.message);
    router.push("/dashboard/overview");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6 flex items-center gap-3">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-lg font-bold text-[#0a1024]">S</div>
        <span className="font-display text-xl font-bold">Secrai</span>
      </div>
      <h1 className="font-display text-2xl font-bold">Start your free trial</h1>
      <p className="mb-6 mt-1 text-sm text-white/50">3 days free. No credit card.</p>
      {notice ? (
        <div className="card p-4 text-sm text-white/70">{notice}</div>
      ) : (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
          <input className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="Company name" value={company} onChange={(e) => setCompany(e.target.value)} required />
          <input className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
            placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
            type="email" placeholder="Work email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="rounded-lg border border-line bg-surface px-3 py-2.5 text-sm outline-none focus:border-brand"
            type="password" placeholder="Password (min 8 chars)" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
          {error && <p className="text-sm text-sev-critical">{error}</p>}
          <button className="btn btn-primary justify-center" disabled={loading}>
            {loading ? "Creating…" : "Create account"}
          </button>
        </form>
      )}
      <p className="mt-5 text-center text-sm text-white/50">
        Already have an account? <Link href="/login" className="text-brand-ink">Log in</Link>
      </p>
    </main>
  );
}
