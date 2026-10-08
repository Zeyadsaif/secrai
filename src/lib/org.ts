import { createClient } from "@/lib/supabase/server";
import type { OrgRole } from "@/lib/database.types";

export interface CurrentContext {
  userId: string;
  email: string;
  organizationId: string;
  organizationName: string;
  role: OrgRole;
}

/**
 * Resolve the signed-in user and their (first) organization membership.
 * Returns null if not signed in or not a member of any org yet.
 * RLS ensures the membership/organization rows belong to this user.
 */
export async function getCurrentContext(): Promise<CurrentContext | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: membership } = await supabase
    .from("memberships")
    .select("role, organization_id, organizations(name)")
    .eq("user_id", user.id)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (!membership) return null;

  // organizations join comes back as an object (or array depending on FK inference).
  const org = Array.isArray((membership as any).organizations)
    ? (membership as any).organizations[0]
    : (membership as any).organizations;

  return {
    userId: user.id,
    email: user.email ?? "",
    organizationId: membership.organization_id,
    organizationName: org?.name ?? "Workspace",
    role: membership.role as OrgRole,
  };
}
