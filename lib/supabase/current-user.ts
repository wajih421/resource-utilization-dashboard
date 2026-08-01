import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database-types";

export type SidebarUser = {
  displayName: string;
  employeeId: string;
  role: "manager" | "resource";
};

// Display-only info for the nav sidebar - never used for authorization
// (that's requireManager()/requireAuth()). Safe to return null; layouts
// render fine without it since the route-level auth check already ran.
export async function getSidebarUser(
  supabase: SupabaseClient<Database>
): Promise<SidebarUser | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, role, resources(name, employee_id)")
    .eq("id", user.id)
    .single();

  if (!profile) return null;

  const resource = profile.resources as { name: string; employee_id: string | null } | null;
  const employeeId = resource?.employee_id ?? profile.email.split("@")[0];

  return {
    displayName: resource?.name ?? employeeId,
    employeeId,
    role: profile.role,
  };
}
