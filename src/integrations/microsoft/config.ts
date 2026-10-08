/**
 * Microsoft integration configuration.
 *
 * Register a MULTI-TENANT app in the Microsoft Entra admin center and grant it
 * the APPLICATION permissions below (admin consent required). Customers then
 * grant admin consent to your app for their own tenant; after that you obtain
 * app-only tokens per tenant via the client-credentials flow.
 *
 * See README.md → "Microsoft app registration" for the click-by-click steps.
 */

export const GRAPH_BASE = "https://graph.microsoft.com/v1.0";
export const GRAPH_BETA = "https://graph.microsoft.com/beta"; // some security endpoints are beta-only

/** Microsoft Defender for Endpoint API — devices, vulnerabilities, recommendations. */
export const DEFENDER_BASE = "https://api.securitycenter.microsoft.com/api";

/** The client-credentials flow requests the .default scope of a resource. */
export const GRAPH_DEFAULT_SCOPE = "https://graph.microsoft.com/.default";
export const DEFENDER_DEFAULT_SCOPE = "https://api.securitycenter.microsoft.com/.default";

/**
 * APPLICATION permissions to grant on the app registration.
 * Two API surfaces are involved, each consented separately in the portal.
 */
export const GRAPH_PERMISSIONS = [
  "SecurityEvents.Read.All", // Secure Score
  "User.Read.All", // Entra users
  "Directory.Read.All", // roles / directory
  "AuditLog.Read.All", // sign-in logs + MFA registration report
  "IdentityRiskyUser.Read.All", // risky users
  "SecurityAlert.Read.All", // unified Defender XDR alerts (MDO + MDE)
  "SecurityIncident.Read.All",
] as const;

export const DEFENDER_PERMISSIONS = [
  "Machine.Read.All", // device inventory
  "Vulnerability.Read.All", // TVM vulnerabilities
  "SecurityRecommendation.Read.All", // TVM recommendations
] as const;

export const REQUIRED_APP_PERMISSIONS = [...GRAPH_PERMISSIONS, ...DEFENDER_PERMISSIONS];

export type MicrosoftDataSource =
  | "secure_score"
  | "entra"
  | "defender_endpoint"
  | "defender_office"
  | "audit_logs";

export const DATA_SOURCES: { key: MicrosoftDataSource; label: string; description: string }[] = [
  { key: "secure_score", label: "Microsoft Secure Score", description: "Overall posture score and control profile." },
  { key: "entra", label: "Entra ID", description: "Users, MFA registration, admin roles, risky users." },
  { key: "defender_endpoint", label: "Defender for Endpoint", description: "Devices, vulnerabilities and recommendations." },
  { key: "defender_office", label: "Defender for Office 365", description: "Email alerts and mail-security posture." },
  { key: "audit_logs", label: "Audit & sign-in logs", description: "Sign-in and directory audit activity." },
];
