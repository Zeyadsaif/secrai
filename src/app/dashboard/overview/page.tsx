import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/org";
import type { FindingRow, SecureScoreRow, Severity } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const SEV_COLORS: Record<string, string> = {
  critical: "#f2547d", high: "#ff8a4c", medium: "#f5c451", low: "#3fd1bd",
};
function band(s: number) {
  if (s >= 90) return "Excellent"; if (s >= 80) return "Good";
  if (s >= 65) return "Needs Attention"; if (s >= 45) return "High Risk"; return "Critical";
}

export default async function OverviewPage() {
  const ctx = (await getCurrentContext())!;
  const supabase = createClient();

  const [{ data: scores }, { data: findings }] = await Promise.all([
    supabase.from("secure_score_history").select("*")
      .eq("organization_id", ctx.organizationId).order("captured_at", { ascending: true }).limit(30),
    supabase.from("findings").select("*")
      .eq("organization_id", ctx.organizationId).order("risk_score", { ascending: false }),
  ]);

  const series = (scores ?? []) as SecureScoreRow[];
  const latest = series[series.length - 1];
  const all = (findings ?? []) as FindingRow[];
  const open = all.filter((f) => f.status === "open" || f.status === "in_progress");
  const sevCount = (s: Severity) => open.filter((f) => f.severity === s).length;
  const resolved = all.filter((f) => f.status === "resolved").length;

  const hasData = series.length > 0 || all.length > 0;

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Security Overview</h1>
          <p className="mt-1 text-sm text-white/50">Live posture for {ctx.organizationName}.</p>
        </div>
        <Link href="/dashboard/integrations" className="btn btn-primary">Connect Microsoft</Link>
      </div>

      {!hasData ? (
        <div className="card grid place-items-center p-14 text-center">
          <p className="max-w-md text-white/60">
            No security data yet. Connect your Microsoft tenant on the{" "}
            <Link href="/dashboard/integrations" className="text-brand-ink">Integrations</Link> page and run a
            sync — Secrai will pull your Secure Score, users, devices and alerts and generate findings automatically.
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-[320px_1fr] gap-4">
            <div className="card p-6">
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/40">Security Score</div>
              <div className="mt-3 font-display text-6xl font-extrabold" style={{ color: SEV_COLORS.low }}>
                {latest ? latest.normalized : "—"}
                <span className="text-lg font-normal text-white/40"> / 100</span>
              </div>
              <div className="mt-1 text-sm text-white/60">{latest ? band(latest.normalized) : "Awaiting first sync"}</div>
              {series.length > 1 && <Sparkline data={series.map((s) => s.normalized)} />}
              {latest && <div className="mt-2 text-xs text-white/40">Microsoft Secure Score · {latest.current_score}/{latest.max_score} points</div>}
            </div>

            <div className="grid grid-cols-4 content-start gap-4">
              {(["critical", "high", "medium", "low"] as Severity[]).map((s) => (
                <div key={s} className="card p-4">
                  <div className="text-xs capitalize text-white/50">{s}</div>
                  <div className="mt-2 font-display text-3xl font-bold" style={{ color: SEV_COLORS[s] }}>{sevCount(s)}</div>
                  <div className="text-xs text-white/40">open findings</div>
                </div>
              ))}
              <Stat label="Total findings" value={all.length} />
              <Stat label="Open" value={open.length} />
              <Stat label="Resolved" value={resolved} />
              <Stat label="Assets synced" value={undefined} href="/dashboard/assets" note="view" />
            </div>
          </div>

          <div className="card mt-4">
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="font-display text-base font-semibold">Top Risks</h2>
              <Link href="/dashboard/findings" className="text-sm text-brand-ink">View all →</Link>
            </div>
            <div className="overflow-x-auto p-2">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
                    <th className="px-3 py-2">Finding</th><th className="px-3 py-2">Severity</th>
                    <th className="px-3 py-2">Risk</th><th className="px-3 py-2">Category</th><th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {open.slice(0, 8).map((f) => (
                    <tr key={f.id} className="border-t border-line/50">
                      <td className="px-3 py-2.5 font-medium">{f.title}
                        <div className="font-mono text-[11px] text-white/40">{f.finding_ref}</div></td>
                      <td className="px-3 py-2.5"><span className={`pill sev-${f.severity}`}>{f.severity}</span></td>
                      <td className="px-3 py-2.5 font-mono" style={{ color: SEV_COLORS[f.severity] }}>{f.risk_score}</td>
                      <td className="px-3 py-2.5 text-white/60">{f.category}</td>
                      <td className="px-3 py-2.5 capitalize text-white/60">{f.status.replace("_", " ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, href, note }: { label: string; value?: number; href?: string; note?: string }) {
  const inner = (
    <div className="card p-4">
      <div className="text-xs text-white/50">{label}</div>
      <div className="mt-2 font-display text-3xl font-bold">{value ?? "—"}</div>
      {note && <div className="text-xs text-brand-ink">{note}</div>}
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Sparkline({ data }: { data: number[] }) {
  const w = 260, h = 44, min = Math.min(...data), max = Math.max(...data);
  const pts = data.map((v, i) => [4 + (i * (w - 8)) / (data.length - 1), h - 4 - ((v - min) / (max - min || 1)) * (h - 8)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 w-full">
      <path d={d} fill="none" stroke="#6d8bff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
