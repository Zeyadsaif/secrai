import { createClient } from "@/lib/supabase/server";
import { getCurrentContext } from "@/lib/org";
import { DATA_SOURCES } from "@/integrations/microsoft/config";
import { ConnectButton, SyncButton } from "@/components/IntegrationActions";
import type { TenantConnectionRow, SyncRunRow } from "@/lib/database.types";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const ctx = (await getCurrentContext())!;
  const supabase = createClient();

  const [{ data: conns }, { data: runs }] = await Promise.all([
    supabase.from("tenant_connections").select("*").eq("organization_id", ctx.organizationId).eq("provider", "microsoft"),
    supabase.from("sync_runs").select("*").eq("organization_id", ctx.organizationId).order("started_at", { ascending: false }).limit(5),
  ]);
  const connections = (conns ?? []) as TenantConnectionRow[];
  const recentRuns = (runs ?? []) as SyncRunRow[];

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Integrations</h1>
          <p className="mt-1 text-sm text-white/50">Connect Microsoft so Secrai can pull live security signals.</p>
        </div>
        {connections.length === 0 && <ConnectButton />}
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-white/5 text-brand-ink">MS</div>
            <div>
              <h2 className="font-display font-semibold">Microsoft 365 &amp; Defender</h2>
              <p className="text-sm text-white/50">Entra ID · Defender for Endpoint · Defender for Office 365 · Secure Score</p>
            </div>
          </div>
          {connections.length > 0 && (
            <span className="pill sev-low">Connected</span>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
          {DATA_SOURCES.map((s) => (
            <div key={s.key} className="rounded-lg border border-line/60 bg-surface2 p-3">
              <div className="text-sm font-medium">{s.label}</div>
              <div className="mt-1 text-xs text-white/45">{s.description}</div>
            </div>
          ))}
        </div>

        {connections.length === 0 ? (
          <p className="mt-5 text-sm text-white/50">
            Not connected. A global admin of your Microsoft tenant grants consent once; after that Secrai syncs on a schedule.
          </p>
        ) : (
          <div className="mt-5 space-y-3">
            {connections.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-line/60 bg-surface2 p-4">
                <div>
                  <div className="font-medium">{c.display_name || c.ms_tenant_id}</div>
                  <div className="font-mono text-xs text-white/45">tenant {c.ms_tenant_id}</div>
                  <div className="mt-1 text-xs text-white/45">
                    {c.status === "error" ? <span className="text-sev-critical">Error: {c.last_error}</span>
                      : c.last_synced_at ? `Last synced ${new Date(c.last_synced_at).toLocaleString()}`
                      : "Never synced"}
                  </div>
                </div>
                <SyncButton connectionId={c.id} />
              </div>
            ))}
          </div>
        )}
      </div>

      {recentRuns.length > 0 && (
        <div className="card mt-4 p-5">
          <h2 className="mb-3 font-display text-base font-semibold">Recent syncs</h2>
          <div className="space-y-2 text-sm">
            {recentRuns.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-t border-line/40 pt-2 first:border-0 first:pt-0">
                <span className="text-white/60">{new Date(r.started_at).toLocaleString()}</span>
                <span className={r.status === "success" ? "text-good" : r.status === "error" ? "text-sev-critical" : "text-white/50"}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
