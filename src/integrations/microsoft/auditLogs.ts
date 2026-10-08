import { graphList, GraphError } from "./graph";
import type { AuditFacts } from "./types";

interface SignIn {
  clientAppUsed?: string;
  status?: { errorCode?: number };
}
interface DirectoryAudit {
  activityDisplayName: string;
  activityDateTime: string;
  initiatedBy?: { user?: { userPrincipalName?: string }; app?: { displayName?: string } };
}

// Legacy authentication clients that should be blocked by conditional access.
const LEGACY_CLIENTS = new Set([
  "Other clients", "IMAP4", "POP3", "SMTP", "MAPI", "Exchange ActiveSync",
  "Exchange Web Services", "Authenticated SMTP", "AutoDiscover",
]);

/** Sign-in volume, failed sign-ins, legacy-auth usage and recent directory changes. */
export async function fetchAuditLogs(token: string): Promise<AuditFacts | null> {
  const since = new Date(Date.now() - 30 * 86_400_000).toISOString();

  let signIns: SignIn[] = [];
  try {
    signIns = await graphList<SignIn>(
      `/auditLogs/signIns?$filter=createdDateTime ge ${since}&$top=1000&$select=clientAppUsed,status`,
      token,
      { maxPages: 5 },
    );
  } catch (e) {
    if (e instanceof GraphError && e.isMissingData) return null;
    throw e;
  }

  let directoryChanges: AuditFacts["recentDirectoryChanges"] = [];
  try {
    const audits = await graphList<DirectoryAudit>(
      `/auditLogs/directoryAudits?$filter=activityDateTime ge ${since}&$top=50`,
      token,
      { maxPages: 1 },
    );
    directoryChanges = audits.slice(0, 25).map((a) => ({
      activity: a.activityDisplayName,
      actor: a.initiatedBy?.user?.userPrincipalName ?? a.initiatedBy?.app?.displayName ?? "system",
      when: a.activityDateTime,
    }));
  } catch (e) {
    if (!(e instanceof GraphError && e.isMissingData)) throw e;
  }

  return {
    signInsLast30d: signIns.length,
    failedSignInsLast30d: signIns.filter((s) => (s.status?.errorCode ?? 0) !== 0).length,
    legacyAuthSignIns: signIns.filter((s) => s.clientAppUsed && LEGACY_CLIENTS.has(s.clientAppUsed)).length,
    recentDirectoryChanges: directoryChanges,
  };
}
