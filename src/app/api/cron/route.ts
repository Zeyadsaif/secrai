import { NextResponse, type NextRequest } from "next/server";
import { serverEnv } from "@/lib/env";
import { runSyncAll } from "@/integrations/microsoft/sync";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * Scheduled sync of every connected tenant.
 * Protect with `Authorization: Bearer <SYNC_SECRET>`. On Vercel, a cron entry
 * in vercel.json (see that file) hits this route every 6 hours; set the same
 * secret so the platform's request is authorized.
 */
async function handle(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${serverEnv().SYNC_SECRET}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const result = await runSyncAll();
  return NextResponse.json({ ok: true, ...result });
}

export const GET = handle;
export const POST = handle;
