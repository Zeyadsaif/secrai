/** Normalized snapshot of a tenant's Microsoft security posture. */
export interface MicrosoftSnapshot {
  tenantId: string;
  capturedAt: string;
  secureScore?: SecureScoreFacts;
  entra?: EntraFacts;
  endpoint?: EndpointFacts;
  office?: OfficeFacts;
  audit?: AuditFacts;
  /** Sources that failed with a soft error (missing license/permission). */
  skipped: string[];
}

export interface SecureScoreFacts {
  current: number;
  max: number;
  /** 0–100 percentage used as Secrai's headline score. */
  normalized: number;
  activeUserCount?: number;
}

export interface DirUser {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
  isAdmin: boolean;
  mfaRegistered: boolean;
  lastSignInDaysAgo: number | null;
  risky: boolean;
}

export interface EntraFacts {
  totalUsers: number;
  admins: number;
  adminRatio: number;
  adminsWithoutMfa: DirUser[];
  mfaRegistrationRate: number; // 0..1 across all users
  inactiveAdmins: DirUser[]; // enabled admins with no sign-in > 90d
  riskyUsers: DirUser[];
}

export interface Device {
  id: string;
  name: string;
  os: string;
  osPlatform: string;
  exposureLevel: string; // 'High' | 'Medium' | 'Low'
  riskScore: string;
  lastSeenDaysAgo: number | null;
  onboardingStatus: string;
  isEol: boolean;
}

export interface Recommendation {
  id: string;
  title: string;
  severity: string;
  remediationType: string;
  weaknesses: number; // count of CVEs
  exposedDevices: number;
}

export interface EndpointFacts {
  devices: Device[];
  unsupportedOsDevices: Device[];
  notOnboardedDevices: Device[];
  criticalRecommendations: Recommendation[];
  exploitableVulnCount: number;
  criticalVulnCount: number;
}

export interface SecurityAlert {
  id: string;
  title: string;
  severity: string; // 'high' | 'medium' | 'low' | 'informational'
  category: string;
  status: string;
  serviceSource: string; // 'microsoftDefenderForOffice365', 'microsoftDefenderForEndpoint', ...
  createdDateTime: string;
}

export interface OfficeFacts {
  emailAlerts: SecurityAlert[];
  phishingAlerts: number;
  malwareAlerts: number;
}

export interface AuditFacts {
  signInsLast30d: number;
  failedSignInsLast30d: number;
  legacyAuthSignIns: number;
  recentDirectoryChanges: { activity: string; actor: string; when: string }[];
}
