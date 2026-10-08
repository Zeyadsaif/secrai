import { NextResponse, type NextRequest } from "next/server";
import { getCurrentContext } from "@/lib/org";
import { createClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";
import { runSyncForConnection, runSyncAll } from "@/integrations/microsoft/sync";
import type { TenantConnectionRow } from "@/lib/database.types";

export const runtime = "nodejs";
export const maxDuration = 300; // sync can take a while on large tenants

/**
 * Trigger a sync.
 *  - With `Authorization: Bearer <SYNC_SECRET>` → sync ALL connected tenants.
 *  - As a signed-in org member with `{ connectionId }` → sync that connection.
 */
export async function POST(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth && auth === `Bearer ${serverEnv().SYNC_SECRET}`) {
    const result = await runSyncAll();
    return NextResponse.json({ ok: true, ...result });
  }

  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { connectionId?: string };
  if (!body.connectionId) return NextResponse.json({ ok: false, error: "connectionId required" }, { status: 400 });

  // RLS on the user client guarantees the connection belongs to their org.
  const supabase = createClient();
  const { data: conn } = await supabase
    .from("tenant_connections")
    .select("*")
    .eq("id", body.connectionId)
    .eq("organization_id", ctx.organizationId)
    .maybeSingle();
  if (!conn) return NextResponse.json({ ok: false, error: "connection not found" }, { status: 404 });

  const result = await runSyncForConnection(conn as TenantConnectionRow);
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}
