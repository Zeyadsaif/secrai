import type { AssetType, Criticality, Severity } from "@/lib/database.types";
import type { MicrosoftSnapshot, Device } from "@/integrations/microsoft/types";
import { ruleById } from "./rules";

export interface EvalAsset {
  external_id: string;
  name: string;
  type: AssetType;
  os: string;
  criticality: Criticality;
  exposure: "public" | "internal" | "isolated";
  status: "active" | "at_risk";
  last_scanned_at: string;
}

export interface EvalFinding {
  rule_id: string;
  finding_ref: string;
  external_id: string;
  title: string;
  category: string;
  severity: Severity;
  risk_score: number;
  description: string;
  business_impact: string;
  technical_impact: string;
  evidence_text: string;
  recommendation: string;
  remediation_steps: string[];
  reference_links: string[];
  detected_at: string;
  due_at: string;
  affectedExternalIds: string[];
}

export interface EvalResult {
  score?: { current: number; max: number; normalized: number };
  assets: EvalAsset[];
  findings: EvalFinding[];
  activity: string[];
  skipped: string[];
}

function deviceType(d: Device): AssetType {
  const p = d.osPlatform?.toLowerCase() ?? "";
  if (p.includes("server")) return "server";
  if (p.includes("ios") || p.includes("android")) return "mobile_device";
  if (p.includes("linux")) return "server";
  if (p.includes("mac")) return "laptop";
  if (p.includes("windows")) return "workstation";
  return "other";
}
function deviceCriticality(d: Device): Criticality {
  switch ((d.exposureLevel ?? "").toLowerCase()) {
    case "high": return "critical";
    case "medium": return "high";
    case "low": return "medium";
    default: return "medium";
  }
}
function dueDate(detected: string, sev: Severity): string {
  const days = sev === "critical" || sev === "high" ? 14 : 30;
  return new Date(new Date(detected).getTime() + days * 86_400_000).toISOString();
}

/**
 * Evaluate a normalized Microsoft snapshot against the Secrai rule catalog.
 * Produces the assets, findings, score and activity to persist. A rule fires
 * ONLY when the live signal actually indicates a failure.
 */
export function evaluateSnapshot(snap: MicrosoftSnapshot): EvalResult {
  const now = snap.capturedAt;
  const assets: EvalAsset[] = [];
  const findings: EvalFinding[] = [];
  const activity: string[] = [];

  // --- Score (Microsoft Secure Score) ---
  const score = snap.secureScore
    ? { current: snap.secureScore.current, max: snap.secureScore.max, normalized: snap.secureScore.normalized }
    : undefined;

  // --- Assets from Defender for Endpoint devices ---
  if (snap.endpoint) {
    for (const d of snap.endpoint.devices) {
      assets.push({
        external_id: d.id,
        name: d.name || d.id,
        type: deviceType(d),
        os: d.os,
        criticality: deviceCriticality(d),
        exposure: "internal",
        status: d.isEol || d.exposureLevel?.toLowerCase() === "high" ? "at_risk" : "active",
        last_scanned_at: now,
      });
    }
  }

  const add = (
    ruleId: string,
    over: Partial<EvalFinding> & { evidence_text: string; business_impact: string; technical_impact: string; affectedExternalIds?: string[]; severity?: Severity; risk_score?: number },
  ) => {
    const rule = ruleById(ruleId);
    if (!rule) return;
    const severity = over.severity ?? rule.severity;
    const detected_at = now;
    findings.push({
      rule_id: ruleId,
      finding_ref: `MS-${ruleId}`,
      external_id: `${snap.tenantId}:${ruleId}`,
      title: over.title ?? rule.name,
      category: rule.category,
      severity,
      risk_score: over.risk_score ?? rule.baseScore,
      description: rule.description,
      business_impact: over.business_impact,
      technical_impact: over.technical_impact,
      evidence_text: over.evidence_text,
      recommendation: rule.recommendation,
      remediation_steps: rule.steps,
      reference_links: rule.references,
      detected_at,
      due_at: dueDate(detected_at, severity),
      affectedExternalIds: over.affectedExternalIds ?? [],
    });
  };

  // --- Identity (Entra) ---
  if (snap.entra) {
    const e = snap.entra;
    if (e.adminsWithoutMfa.length > 0) {
      add("SEC-001", {
        evidence_text: `${e.adminsWithoutMfa.length} of ${e.admins} privileged accounts have no MFA registered: ${e.adminsWithoutMfa.slice(0, 5).map((u) => u.userPrincipalName).join(", ")}${e.adminsWithoutMfa.length > 5 ? "…" : ""}`,
        business_impact: "A single stolen admin password would give an attacker privileged control of the tenant.",
        technical_impact: "Privileged Entra accounts authenticate with a password alone; no second factor is registered.",
        affectedExternalIds: e.adminsWithoutMfa.map((u) => u.id),
      });
    }
    if (e.inactiveAdmins.length > 0) {
      add("SEC-003", {
        evidence_text: `${e.inactiveAdmins.length} enabled admin account(s) with no sign-in in 90+ days: ${e.inactiveAdmins.slice(0, 5).map((u) => u.userPrincipalName).join(", ")}`,
        business_impact: "Dormant privileged accounts expand the attack surface with no operational benefit.",
        technical_impact: "Entra sign-in activity shows these admin accounts inactive for over 90 days while still enabled.",
        affectedExternalIds: e.inactiveAdmins.map((u) => u.id),
      });
    }
    if (e.adminRatio > 0.05) {
      add("SEC-012", {
        risk_score: 58 + Math.min(20, Math.round((e.adminRatio - 0.05) * 200)),
        evidence_text: `${(e.adminRatio * 100).toFixed(1)}% of users (${e.admins} of ${e.totalUsers}) hold standing admin roles vs a 5% target.`,
        business_impact: "Excess standing privilege raises the blast radius if any account is compromised.",
        technical_impact: "Directory role assignments exceed least-privilege guidance across the tenant.",
      });
    }
    if (e.riskyUsers.length > 0) {
      add("SEC-002", {
        severity: "high",
        evidence_text: `${e.riskyUsers.length} user(s) flagged at risk by Entra Identity Protection: ${e.riskyUsers.slice(0, 5).map((u) => u.userPrincipalName).join(", ")}`,
        business_impact: "Risky accounts indicate probable credential compromise and imminent account takeover.",
        technical_impact: "Entra Identity Protection reports these users in an at-risk state.",
        affectedExternalIds: e.riskyUsers.map((u) => u.id),
      });
    }
  }

  // --- Endpoint (Defender for Endpoint / TVM) ---
  if (snap.endpoint) {
    const ep = snap.endpoint;
    if (ep.unsupportedOsDevices.length > 0) {
      add("SEC-004", {
        evidence_text: `${ep.unsupportedOsDevices.length} device(s) on end-of-life operating systems: ${ep.unsupportedOsDevices.slice(0, 5).map((d) => `${d.name} (${d.os})`).join(", ")}`,
        business_impact: "End-of-life systems receive no security patches, leaving permanent unfixable exposure.",
        technical_impact: "Defender device inventory shows operating systems past their end-of-support date.",
        affectedExternalIds: ep.unsupportedOsDevices.map((d) => d.id),
      });
    }
    if (ep.notOnboardedDevices.length > 0) {
      add("SEC-005", {
        evidence_text: `${ep.notOnboardedDevices.length} device(s) not fully onboarded to Defender EDR.`,
        business_impact: "Unmonitored endpoints can host malware undetected.",
        technical_impact: "Devices report an onboarding status other than 'Onboarded'.",
        affectedExternalIds: ep.notOnboardedDevices.map((d) => d.id),
      });
    }
    if (ep.criticalVulnCount > 0 || ep.exploitableVulnCount > 0) {
      add("SEC-006", {
        risk_score: ep.exploitableVulnCount > 0 ? 95 : 88,
        evidence_text: `${ep.criticalVulnCount} critical vulnerabilities detected${ep.exploitableVulnCount > 0 ? `, ${ep.exploitableVulnCount} with public exploit code` : ""} across the estate (Defender TVM).`,
        business_impact: "Exploitable flaws on managed systems could lead to breach, outage and regulatory exposure.",
        technical_impact: "Defender Threat & Vulnerability Management reports critical, in some cases exploitable, CVEs.",
      });
    }
    const patchRecs = ep.criticalRecommendations.filter((r) => /update|patch/i.test(r.remediationType));
    if (patchRecs.length > 0) {
      add("SEC-011", {
        evidence_text: `${patchRecs.length} high-priority software-update recommendation(s), e.g. "${patchRecs[0].title}" affecting ${patchRecs[0].exposedDevices} device(s).`,
        business_impact: "Lagging patches widen the exploitable window on managed systems.",
        technical_impact: "Defender TVM lists unremediated critical software-update recommendations.",
      });
    }
  }

  // --- Email (Defender for Office 365) ---
  if (snap.office && (snap.office.phishingAlerts > 0 || snap.office.malwareAlerts > 0)) {
    add("SEC-010", {
      evidence_text: `Defender for Office 365 raised ${snap.office.phishingAlerts} phishing and ${snap.office.malwareAlerts} malware alert(s).`,
      business_impact: "Email threats reaching mailboxes are the most common initial-access vector.",
      technical_impact: "Active Defender for Office 365 alerts indicate malicious mail is being delivered or detected.",
    });
  }

  // --- Remote access & brute force (audit logs) ---
  if (snap.audit) {
    if (snap.audit.legacyAuthSignIns > 0) {
      add("SEC-019", {
        evidence_text: `${snap.audit.legacyAuthSignIns} sign-in(s) in the last 30 days used legacy authentication protocols that bypass MFA.`,
        business_impact: "Legacy authentication is a leading initial-access vector because it cannot enforce MFA.",
        technical_impact: "Entra sign-in logs show legacy-auth clients (IMAP/POP/SMTP/etc.) in active use.",
      });
    }
    if (snap.audit.failedSignInsLast30d > 100) {
      add("SEC-024", {
        evidence_text: `${snap.audit.failedSignInsLast30d} failed sign-ins in the last 30 days suggest brute-force or password-spray activity.`,
        business_impact: "Without smart lockout, sustained guessing can eventually compromise an account.",
        technical_impact: "A high failed-sign-in volume appears in the Entra sign-in logs.",
      });
    }
  }

  // Activity summary lines.
  if (score) activity.push(`Synced Microsoft Secure Score: ${score.normalized}/100`);
  if (snap.entra) activity.push(`Synced ${snap.entra.totalUsers} Entra users (${snap.entra.admins} admins)`);
  if (snap.endpoint) activity.push(`Synced ${snap.endpoint.devices.length} Defender devices`);
  activity.push(`Risk engine created/updated ${findings.length} findings`);

  return { score, assets, findings, activity, skipped: snap.skipped };
}
