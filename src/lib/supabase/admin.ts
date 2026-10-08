import { createClient } from "@supabase/supabase-js";
import { serverEnv } from "@/lib/env";

/**
 * Service-role Supabase client. BYPASSES Row-Level Security.
 * SERVER-ONLY, and only for trusted background work (the sync job writing
 * findings/assets on behalf of a tenant). Never expose to the browser and
 * never build a query from unvalidated user input with this client.
 */
export function createAdminClient() {
  const env = serverEnv();
  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
