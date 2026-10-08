import { ConfidentialClientApplication } from "@azure/msal-node";
import { serverEnv } from "@/lib/env";
import { GRAPH_DEFAULT_SCOPE } from "./config";

/**
 * Microsoft OAuth for a multi-tenant app.
 *
 * Flow:
 *  1. Customer admin visits buildAdminConsentUrl() and grants consent.
 *  2. Microsoft redirects to MS_REDIRECT_URI with ?tenant=<their tenantId>&admin_consent=True&state=<state>.
 *  3. We persist a tenant_connections row for that tenant.
 *  4. On each sync we call getAppToken(tenantId) — an app-only token via
 *     client credentials — and call Graph as the application.
 */

/** Build the admin-consent URL a customer's global admin clicks once. */
export function buildAdminConsentUrl(state: string): string {
  const env = serverEnv();
  const url = new URL(`${env.MS_AUTHORITY_HOST}/common/adminconsent`);
  url.searchParams.set("client_id", env.MS_CLIENT_ID);
  url.searchParams.set("redirect_uri", env.MS_REDIRECT_URI);
  url.searchParams.set("state", state);
  return url.toString();
}

// One confidential client per tenant authority, cached for token reuse.
const clients = new Map<string, ConfidentialClientApplication>();

function clientFor(tenantId: string): ConfidentialClientApplication {
  const existing = clients.get(tenantId);
  if (existing) return existing;
  const env = serverEnv();
  const cca = new ConfidentialClientApplication({
    auth: {
      clientId: env.MS_CLIENT_ID,
      clientSecret: env.MS_CLIENT_SECRET,
      authority: `${env.MS_AUTHORITY_HOST}/${tenantId}`,
    },
  });
  clients.set(tenantId, cca);
  return cca;
}

/**
 * Acquire an app-only access token for a specific customer tenant.
 * @param scope resource .default scope (Graph by default; pass the Defender
 *              scope for the Defender for Endpoint API).
 */
export async function getAppToken(
  tenantId: string,
  scope: string = GRAPH_DEFAULT_SCOPE,
): Promise<string> {
  const result = await clientFor(tenantId).acquireTokenByClientCredential({
    scopes: [scope],
  });
  if (!result?.accessToken) {
    throw new Error(`Failed to acquire Microsoft token (${scope}) for tenant ${tenantId}`);
  }
  return result.accessToken;
}
