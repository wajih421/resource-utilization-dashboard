import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { Database } from "@/types/database-types";

export type RequireResult = { user: User } | { error: NextResponse };

// Shared RBAC gate for every app/api/manager/** route. Previously this same
// function body was copy-pasted into 4+ route files (drifting slightly each
// time — some returned {error,status} objects, some returned NextResponse
// directly). Centralized here so a change to the manager-check logic (e.g.
// adding an "admin" role) only needs to happen once.
export async function requireManager(
  supabase: SupabaseClient<Database>
): Promise<RequireResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || profile?.role !== "manager") {
    return { error: NextResponse.json({ error: "Manager access only" }, { status: 403 }) };
  }

  return { user };
}

// Lighter gate for routes any logged-in user (manager or resource) may call.
export async function requireAuth(
  supabase: SupabaseClient<Database>
): Promise<RequireResult> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }

  return { user };
}
