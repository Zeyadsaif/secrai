import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

/**
 * Microsoft redirects here after admin consent with:
 *   ?admin_consent=True&tenant=<tenantId>&state=<organizationId>
 * We verify the signed-in user owns that org, then persist the connection.
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const tenant = sp.get("tenant");
  const consent = sp.get("admin_consent");
  const state = sp.get("state");
  const to = (q: string) => NextResponse.redirect(new URL(`/dashboard/integrations${q}`, publicEnv.appUrl));

  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", publicEnv.appUrl));
  if (state !== ctx.organizationId) return to("?error=state_mismatch");
  if (consent !== "True" || !tenant) return to(`?error=${encodeURIComponent(sp.get("error_description") || "consent_declined")}`);

  const supabase = createClient();
  const { error } = await supabase.from("tenant_connections").upsert(
    {
      organization_id: ctx.organizationId,
      provider: "microsoft",
      ms_tenant_id: tenant,
      display_name: "Microsoft 365",
      status: "connected",
      created_by: ctx.userId,
    },
    { onConflict: "organization_id,provider,ms_tenant_id" },
  );
  if (error) return to(`?error=${encodeURIComponent(error.message)}`);
  return to("?connected=1");
}
