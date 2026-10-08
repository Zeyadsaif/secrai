import { graphList, GraphError } from "./graph";
import type { DirUser, EntraFacts } from "./types";

interface RegDetail {
  id: string;
  userPrincipalName: string;
  userDisplayName: string;
  isAdmin: boolean;
  isMfaRegistered: boolean;
}
interface GraphUser {
  id: string;
  accountEnabled: boolean;
  signInActivity?: { lastSignInDateTime?: string | null };
}
interface RiskyUser {
  id: string;
  userPrincipalName: string;
  userDisplayName: string;
  riskLevel: string;
  riskState: string;
}

function daysAgo(iso?: string | null): number | null {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

/** Entra ID posture: users, MFA registration, admin ratio, inactivity, risk. */
export async function fetchEntra(token: string): Promise<EntraFacts | null> {
  // 1) MFA + admin status per user (single authoritative report).
  const reg = await graphList<RegDetail>(
    "/reports/authenticationMethods/userRegistrationDetails?$top=500",
    token,
  );
  if (reg.length === 0) return null;

  // 2) Sign-in activity + enabled state (best-effort; needs Entra ID P1/P2).
  const signInByUpn = new Map<string, { enabled: boolean; lastSignIn: string | null }>();
  try {
    const users = await graphList<GraphUser & { userPrincipalName: string }>(
      "/users?$select=id,userPrincipalName,accountEnabled,signInActivity&$top=999",
      token,
    );
    for (const u of users) {
      signInByUpn.set(u.userPrincipalName?.toLowerCase() ?? u.id, {
        enabled: u.accountEnabled ?? true,
        lastSignIn: u.signInActivity?.lastSignInDateTime ?? null,
      });
    }
  } catch (e) {
    if (!(e instanceof GraphError && e.isMissingData)) throw e;
  }

  // 3) Risky users (Identity Protection; needs P2).
  const riskyByUpn = new Set<string>();
  try {
    const risky = await graphList<RiskyUser>(
      "/identityProtection/riskyUsers?$filter=riskState eq 'atRisk'&$top=200",
      token,
    );
    risky.forEach((r) => riskyByUpn.add(r.userPrincipalName?.toLowerCase()));
  } catch (e) {
    if (!(e instanceof GraphError && e.isMissingData)) throw e;
  }

  const dir: DirUser[] = reg.map((r) => {
    const key = r.userPrincipalName?.toLowerCase();
    const si = signInByUpn.get(key);
    return {
      id: r.id,
      displayName: r.userDisplayName,
      userPrincipalName: r.userPrincipalName,
      accountEnabled: si?.enabled ?? true,
      isAdmin: r.isAdmin,
      mfaRegistered: r.isMfaRegistered,
      lastSignInDaysAgo: daysAgo(si?.lastSignIn),
      risky: riskyByUpn.has(key),
    };
  });

  const total = dir.length;
  const admins = dir.filter((u) => u.isAdmin);
  const mfaRegistered = dir.filter((u) => u.mfaRegistered).length;

  return {
    totalUsers: total,
    admins: admins.length,
    adminRatio: total ? admins.length / total : 0,
    adminsWithoutMfa: admins.filter((u) => !u.mfaRegistered),
    mfaRegistrationRate: total ? mfaRegistered / total : 0,
    inactiveAdmins: admins.filter(
      (u) => u.accountEnabled && u.lastSignInDaysAgo !== null && u.lastSignInDaysAgo > 90,
    ),
    riskyUsers: dir.filter((u) => u.risky),
  };
}
