import { NextResponse } from "next/server";
import { getCurrentContext } from "@/lib/org";
import { buildAdminConsentUrl } from "@/integrations/microsoft/auth";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";

/** Kicks off Microsoft admin consent. The org id travels in `state`. */
export async function GET() {
  const ctx = await getCurrentContext();
  if (!ctx) return NextResponse.redirect(new URL("/login", publicEnv.appUrl));
  return NextResponse.redirect(buildAdminConsentUrl(ctx.organizationId));
}
