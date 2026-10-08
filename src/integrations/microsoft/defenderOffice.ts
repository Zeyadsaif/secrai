import { graphList, GraphError } from "./graph";
import type { OfficeFacts, SecurityAlert } from "./types";

interface AlertV2 {
  id: string;
  title: string;
  severity: string;
  category: string;
  status: string;
  serviceSource: string;
  createdDateTime: string;
}

/**
 * Defender for Office 365 signals via the unified Defender XDR alerts API.
 * Endpoint: GET /security/alerts_v2 filtered to the Office 365 service source.
 */
export async function fetchDefenderOffice(token: string): Promise<OfficeFacts | null> {
  let alerts: AlertV2[] = [];
  try {
    alerts = await graphList<AlertV2>(
      "/security/alerts_v2?$filter=serviceSource eq 'microsoftDefenderForOffice365'&$top=200",
      token,
      { maxPages: 5 },
    );
  } catch (e) {
    if (e instanceof GraphError && e.isMissingData) return null;
    throw e;
  }

  const emailAlerts: SecurityAlert[] = alerts.map((a) => ({
    id: a.id,
    title: a.title,
    severity: a.severity,
    category: a.category,
    status: a.status,
    serviceSource: a.serviceSource,
    createdDateTime: a.createdDateTime,
  }));

  const cat = (s: string) => (a: SecurityAlert) => a.category?.toLowerCase().includes(s);
  return {
    emailAlerts,
    phishingAlerts: emailAlerts.filter(cat("phish")).length,
    malwareAlerts: emailAlerts.filter(cat("malware")).length,
  };
}
