import { graphList } from "./graph";
import type { SecureScoreFacts } from "./types";

interface GraphSecureScore {
  currentScore: number;
  maxScore: number;
  activeUserCount?: number;
  createdDateTime: string;
}

/**
 * Microsoft Secure Score — the latest daily snapshot.
 * Endpoint: GET /security/secureScores  (returns newest first).
 */
export async function fetchSecureScore(token: string): Promise<SecureScoreFacts | null> {
  const scores = await graphList<GraphSecureScore>(
    "/security/secureScores?$top=1",
    token,
    { maxPages: 1 },
  );
  const latest = scores[0];
  if (!latest || !latest.maxScore) return null;
  const normalized = Math.round((latest.currentScore / latest.maxScore) * 100);
  return {
    current: Math.round(latest.currentScore),
    max: Math.round(latest.maxScore),
    normalized,
    activeUserCount: latest.activeUserCount,
  };
}
