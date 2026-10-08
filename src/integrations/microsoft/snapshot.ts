import { getAppToken } from "./auth";
import { GRAPH_DEFAULT_SCOPE, DEFENDER_DEFAULT_SCOPE } from "./config";
import { GraphError } from "./graph";
import { fetchSecureScore } from "./secureScore";
import { fetchEntra } from "./entra";
import { fetchDefenderEndpoint } from "./defenderEndpoint";
import { fetchDefenderOffice } from "./defenderOffice";
import { fetchAuditLogs } from "./auditLogs";
import type { MicrosoftSnapshot } from "./types";

/**
 * Collect a full normalized security snapshot for one customer tenant.
 * Each source fails soft: a missing license/permission adds the source to
 * `skipped` rather than aborting the whole sync.
 */
export async function collectSnapshot(tenantId: string): Promise<MicrosoftSnapshot> {
  const snapshot: MicrosoftSnapshot = {
    tenantId,
    capturedAt: new Date().toISOString(),
    skipped: [],
  };

  const graphToken = await getAppToken(tenantId, GRAPH_DEFAULT_SCOPE);

  await run("secure_score", async () => {
    snapshot.secureScore = (await fetchSecureScore(graphToken)) ?? undefined;
  }, snapshot);

  await run("entra", async () => {
    snapshot.entra = (await fetchEntra(graphToken)) ?? undefined;
  }, snapshot);

  await run("defender_office", async () => {
    snapshot.office = (await fetchDefenderOffice(graphToken)) ?? undefined;
  }, snapshot);

  await run("audit_logs", async () => {
    snapshot.audit = (await fetchAuditLogs(graphToken)) ?? undefined;
  }, snapshot);

  // Defender for Endpoint uses a different resource token.
  await run("defender_endpoint", async () => {
    const defenderToken = await getAppToken(tenantId, DEFENDER_DEFAULT_SCOPE);
    snapshot.endpoint = (await fetchDefenderEndpoint(defenderToken)) ?? undefined;
  }, snapshot);

  return snapshot;
}

async function run(
  source: string,
  fn: () => Promise<void>,
  snapshot: MicrosoftSnapshot,
): Promise<void> {
  try {
    await fn();
  } catch (e) {
    // Soft-fail on missing license/permission; rethrow genuine errors.
    if (e instanceof GraphError && e.isMissingData) {
      snapshot.skipped.push(source);
      return;
    }
    // Token acquisition for a resource the customer didn't consent to also soft-fails.
    if (e instanceof Error && /token|consent|scope/i.test(e.message)) {
      snapshot.skipped.push(source);
      return;
    }
    throw e;
  }
}
