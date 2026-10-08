import { graphList, GraphError } from "./graph";
import { DEFENDER_BASE } from "./config";
import type { Device, EndpointFacts, Recommendation } from "./types";

interface MdeMachine {
  id: string;
  computerDnsName: string;
  osPlatform: string;
  version: string;
  osProcessor?: string;
  healthStatus: string;
  onboardingStatus: string;
  riskScore: string;
  exposureLevel: string;
  lastSeen: string;
}
interface MdeRecommendation {
  id: string;
  recommendationName: string;
  severityScore: number;
  remediationType: string;
  weaknesses: number;
  exposedMachinesCount: number;
  publicExploit: boolean;
  status: string;
}
interface MdeVulnerability {
  id: string;
  severity: string; // 'Critical' | 'High' | ...
  publicExploit: boolean;
  exploitVerified: boolean;
}

// Operating systems past end-of-life (no security updates).
const EOL_MATCHERS = [/2008/, /2012/, /windows7/i, /windowsxp/i, /windows8(?!\.1)/i];
function isEol(platform: string, version: string): boolean {
  const s = `${platform} ${version}`.toLowerCase();
  return EOL_MATCHERS.some((re) => re.test(s));
}
function daysAgo(iso?: string): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Defender for Endpoint: devices + Threat & Vulnerability Management. */
export async function fetchDefenderEndpoint(defenderToken: string): Promise<EndpointFacts | null> {
  let machines: MdeMachine[] = [];
  try {
    machines = await graphList<MdeMachine>("/machines", defenderToken, { base: DEFENDER_BASE });
  } catch (e) {
    if (e instanceof GraphError && e.isMissingData) return null;
    throw e;
  }

  const devices: Device[] = machines.map((m) => ({
    id: m.id,
    name: m.computerDnsName,
    os: `${m.osPlatform} ${m.version}`.trim(),
    osPlatform: m.osPlatform,
    exposureLevel: m.exposureLevel,
    riskScore: m.riskScore,
    lastSeenDaysAgo: daysAgo(m.lastSeen),
    onboardingStatus: m.onboardingStatus,
    isEol: isEol(m.osPlatform, m.version),
  }));

  // Recommendations (TVM). Soft-fail if not licensed.
  let recs: MdeRecommendation[] = [];
  try {
    recs = await graphList<MdeRecommendation>("/recommendations", defenderToken, {
      base: DEFENDER_BASE,
      maxPages: 20,
    });
  } catch (e) {
    if (!(e instanceof GraphError && e.isMissingData)) throw e;
  }

  const criticalRecommendations: Recommendation[] = recs
    .filter((r) => r.severityScore >= 7 || r.publicExploit)
    .slice(0, 100)
    .map((r) => ({
      id: r.id,
      title: r.recommendationName,
      severity: r.publicExploit ? "critical" : r.severityScore >= 8 ? "high" : "medium",
      remediationType: r.remediationType,
      weaknesses: r.weaknesses,
      exposedDevices: r.exposedMachinesCount,
    }));

  // Vulnerability counts (bounded).
  let criticalVulnCount = 0;
  let exploitableVulnCount = 0;
  try {
    const vulns = await graphList<MdeVulnerability>("/vulnerabilities", defenderToken, {
      base: DEFENDER_BASE,
      maxPages: 30,
    });
    criticalVulnCount = vulns.filter((v) => v.severity === "Critical").length;
    exploitableVulnCount = vulns.filter((v) => v.publicExploit || v.exploitVerified).length;
  } catch (e) {
    if (!(e instanceof GraphError && e.isMissingData)) throw e;
  }

  return {
    devices,
    unsupportedOsDevices: devices.filter((d) => d.isEol),
    notOnboardedDevices: devices.filter(
      (d) => d.onboardingStatus && d.onboardingStatus !== "Onboarded",
    ),
    criticalRecommendations,
    exploitableVulnCount,
    criticalVulnCount,
  };
}
