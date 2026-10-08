import { createAdminClient } from "@/lib/supabase/admin";
import { collectSnapshot } from "./snapshot";
import { evaluateSnapshot } from "@/engine/map";
import type { TenantConnectionRow } from "@/lib/database.types";

export interface SyncResult {
  ok: boolean;
  assets: number;
  findings: number;
  score: number | null;
  skipped: string[];
  error?: string;
}

/**
 * Full sync for one connected Microsoft tenant:
 *   collect snapshot -> evaluate against rules -> persist assets, findings,
 *   score history and activity. Uses the service-role client because it writes
 *   on behalf of the tenant from a trusted background context.
 */
export async function runSyncForConnection(conn: TenantConnectionRow): Promise<SyncResult> {
  const db = createAdminClient();
  const orgId = conn.organization_id;

  const { data: runRow } = await db
    .from("sync_runs")
    .insert({ organization_id: orgId, connection_id: conn.id, status: "running", source: "microsoft", stats: {}, started_at: new Date().toISOString() })
    .select("id")
    .single();
  const runId = runRow?.id;

  try {
    if (!conn.ms_tenant_id) throw new Error("Connection has no Microsoft tenant id");

    const snapshot = await collectSnapshot(conn.ms_tenant_id);
    const result = evaluateSnapshot(snapshot);

    // 1) Upsert assets, capturing DB ids keyed by their Microsoft external id.
    const externalToId = new Map<string, string>();
    if (result.assets.length) {
      const rows = result.assets.map((a) => ({
        organization_id: orgId,
        external_id: a.external_id,
        source: "microsoft",
        name: a.name,
        type: a.type,
        operating_system: a.os,
        criticality: a.criticality,
        exposure: a.exposure,
        status: a.status,
        last_scanned_at: a.last_scanned_at,
      }));
      const { data, error } = await db
        .from("assets")
        .upsert(rows, { onConflict: "organization_id,external_id" })
        .select("id,external_id");
      if (error) throw error;
      for (const r of data ?? []) if (r.external_id) externalToId.set(r.external_id, r.id);
    }

    // 2) Upsert findings (stable finding_ref per rule so re-syncs update in place).
    let findingCount = 0;
    for (const f of result.findings) {
      const { data: fRow, error } = await db
        .from("findings")
        .upsert(
          {
            organization_id: orgId,
            finding_ref: f.finding_ref,
            external_id: f.external_id,
            source: "microsoft",
            rule_id: f.rule_id,
            title: f.title,
            category: f.category,
            severity: f.severity,
            risk_score: f.risk_score,
            status: "open",
            description: f.description,
            business_impact: f.business_impact,
            technical_impact: f.technical_impact,
            evidence_text: f.evidence_text,
            recommendation: f.recommendation,
            remediation_steps: f.remediation_steps,
            reference_links: f.reference_links,
            detected_at: f.detected_at,
            due_at: f.due_at,
          },
          { onConflict: "organization_id,finding_ref" },
        )
        .select("id")
        .single();
      if (error) throw error;
      findingCount++;

      // 3) Link findings to their affected assets.
      const links = f.affectedExternalIds
        .map((ext) => externalToId.get(ext))
        .filter((id): id is string => Boolean(id))
        .map((assetId) => ({ organization_id: orgId, finding_id: fRow!.id, asset_id: assetId }));
      if (links.length) {
        await db.from("finding_assets").upsert(links, { onConflict: "finding_id,asset_id" });
      }
    }

    // 4) Secure Score history point.
    if (result.score) {
      await db.from("secure_score_history").insert({
        organization_id: orgId,
        captured_at: snapshot.capturedAt,
        current_score: result.score.current,
        max_score: result.score.max,
        normalized: result.score.normalized,
        source: "microsoft",
      });
    }

    // 5) Activity log.
    if (result.activity.length) {
      await db.from("activity_logs").insert(
        result.activity.map((line) => ({
          organization_id: orgId,
          action: "microsoft.sync",
          object_type: "sync",
          object_ref: conn.display_name ?? conn.ms_tenant_id,
          metadata: { summary: line },
        })),
      );
    }

    // 6) Mark connection + run healthy.
    await db.from("tenant_connections").update({
      status: "connected", last_synced_at: snapshot.capturedAt, last_error: null,
    }).eq("id", conn.id);

    const stats = { assets: result.assets.length, findings: findingCount, score: result.score?.normalized ?? null, skipped: result.skipped };
    if (runId) await db.from("sync_runs").update({ status: "success", stats, finished_at: new Date().toISOString() }).eq("id", runId);

    return { ok: true, assets: result.assets.length, findings: findingCount, score: result.score?.normalized ?? null, skipped: result.skipped };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (runId) await db.from("sync_runs").update({ status: "error", error: message, finished_at: new Date().toISOString() }).eq("id", runId);
    await db.from("tenant_connections").update({ status: "error", last_error: message }).eq("id", conn.id);
    return { ok: false, assets: 0, findings: 0, score: null, skipped: [], error: message };
  }
}

/** Sync every connected Microsoft tenant (used by the scheduled cron route). */
export async function runSyncAll(): Promise<{ connections: number; results: SyncResult[] }> {
  const db = createAdminClient();
  const { data: conns } = await db
    .from("tenant_connections")
    .select("*")
    .eq("provider", "microsoft")
    .neq("status", "disconnected");
  const results: SyncResult[] = [];
  for (const c of conns ?? []) results.push(await runSyncForConnection(c as TenantConnectionRow));
  return { connections: conns?.length ?? 0, results };
}
