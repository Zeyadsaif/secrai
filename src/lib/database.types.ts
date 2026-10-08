/**
 * Hand-authored subset of the Supabase schema, covering the tables this app
 * reads and writes. Regenerate the full version any time with:
 *   supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 */

export type Severity = "critical" | "high" | "medium" | "low" | "info";
export type FindingStatus =
  | "open" | "in_progress" | "accepted_risk" | "resolved" | "false_positive";
export type AssetType =
  | "server" | "workstation" | "laptop" | "mobile_device" | "network_device"
  | "database" | "cloud_resource" | "application" | "domain" | "user_account"
  | "email_account" | "other";
export type Criticality = "critical" | "high" | "medium" | "low";
export type Exposure = "public" | "internal" | "isolated";
export type OrgRole = "owner" | "admin" | "security_manager" | "analyst" | "viewer";

export interface OrganizationRow {
  id: string; name: string; slug: string; industry: string | null;
  size: string | null; country: string | null; website: string | null;
  logo_url: string | null; created_at: string; updated_at: string;
}

export interface AssetRow {
  id: string; organization_id: string; asset_ref: string | null; name: string;
  type: AssetType; ip_address: string | null; hostname: string | null;
  operating_system: string | null; owner_name: string | null; department: string | null;
  location: string | null; criticality: Criticality; exposure: Exposure;
  status: "active" | "at_risk" | "decommissioned"; last_scanned_at: string | null;
  metadata: Record<string, unknown>; source: string | null; external_id: string | null;
  created_at: string; updated_at: string;
}

export interface FindingRow {
  id: string; organization_id: string; finding_ref: string | null; rule_id: string | null;
  assessment_id: string | null; title: string; category: string | null; severity: Severity;
  risk_score: number; status: FindingStatus; description: string | null;
  business_impact: string | null; technical_impact: string | null; evidence_text: string | null;
  recommendation: string | null; remediation_steps: string[]; reference_links: string[];
  owner_id: string | null; source: string | null; external_id: string | null;
  detected_at: string; due_at: string | null; resolved_at: string | null;
  created_at: string; updated_at: string;
}

export interface TenantConnectionRow {
  id: string; organization_id: string; provider: string; ms_tenant_id: string | null;
  display_name: string | null; status: "connected" | "error" | "disconnected";
  scopes: string[]; secret_encrypted: string | null; last_synced_at: string | null;
  last_error: string | null; created_by: string | null; created_at: string; updated_at: string;
}

export interface SyncRunRow {
  id: string; organization_id: string; connection_id: string | null;
  status: "running" | "success" | "error"; source: string;
  stats: Record<string, unknown>; error: string | null;
  started_at: string; finished_at: string | null;
}

export interface SecureScoreRow {
  id: string; organization_id: string; captured_at: string;
  current_score: number; max_score: number; normalized: number; source: string;
}

export interface ActivityRow {
  id: string; organization_id: string; actor_id: string | null; action: string;
  object_type: string | null; object_ref: string | null;
  metadata: Record<string, unknown>; created_at: string;
}

type TableDef<R> = { Row: R; Insert: Partial<R> & Record<string, unknown>; Update: Partial<R> };

export interface Database {
  public: {
    Tables: {
      organizations: TableDef<OrganizationRow>;
      memberships: TableDef<{
        id: string; organization_id: string; user_id: string; role: OrgRole;
        status: "active" | "invited" | "disabled"; department: string | null;
        mfa_enabled: boolean; last_active_at: string | null;
      }>;
      assets: TableDef<AssetRow>;
      findings: TableDef<FindingRow>;
      finding_assets: TableDef<{ finding_id: string; asset_id: string; organization_id: string }>;
      tenant_connections: TableDef<TenantConnectionRow>;
      sync_runs: TableDef<SyncRunRow>;
      secure_score_history: TableDef<SecureScoreRow>;
      activity_logs: TableDef<ActivityRow>;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      severity: Severity; finding_status: FindingStatus; asset_type: AssetType;
    };
  };
}
