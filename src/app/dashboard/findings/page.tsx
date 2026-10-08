import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/org";
import type { FindingRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

const SEV_COLORS: Record<string, string> = {
  critical: "#f2547d", high: "#ff8a4c", medium: "#f5c451", low: "#3fd1bd",
};

export default async function FindingsPage() {
  const ctx = (await getCurrentContext())!;
  const supabase = createClient();
  const { data } = await supabase.from("findings").select("*")
    .eq("organization_id", ctx.organizationId).order("risk_score", { ascending: false });
  const findings = (data ?? []) as FindingRow[];

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Findings</h1>
      <p className="mb-6 mt-1 text-sm text-white/50">{findings.length} findings raised by the risk engine.</p>

      {findings.length === 0 ? (
        <div className="card grid place-items-center p-14 text-center text-white/60">
          No findings yet — connect Microsoft and run a sync to populate them.
        </div>
      ) : (
        <div className="card overflow-x-auto p-2">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-white/40">
                <th className="px-3 py-2">Finding</th><th className="px-3 py-2">Severity</th>
                <th className="px-3 py-2">Risk</th><th className="px-3 py-2">Category</th>
                <th className="px-3 py-2">Rule</th><th className="px-3 py-2">Evidence</th>
              </tr>
            </thead>
            <tbody>
              {findings.map((f) => (
                <tr key={f.id} className="border-t border-line/50 align-top">
                  <td className="px-3 py-3 font-medium">{f.title}
                    <div className="font-mono text-[11px] text-white/40">{f.finding_ref}</div></td>
                  <td className="px-3 py-3"><span className={`pill sev-${f.severity}`}>{f.severity}</span></td>
                  <td className="px-3 py-3 font-mono" style={{ color: SEV_COLORS[f.severity] }}>{f.risk_score}</td>
                  <td className="px-3 py-3 text-white/60">{f.category}</td>
                  <td className="px-3 py-3 font-mono text-xs text-brand-ink">{f.rule_id}</td>
                  <td className="max-w-md px-3 py-3 text-xs text-white/50">{f.evidence_text}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
