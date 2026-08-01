// app/api/manager/audit-log/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/supabase/require-manager";

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get("entityType") || undefined;
    const action = searchParams.get("action") || undefined;
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const limit = Math.min(Number(searchParams.get("limit")) || DEFAULT_LIMIT, MAX_LIMIT);
    const offset = Number(searchParams.get("offset")) || 0;

    let query = supabase
      .from("audit_logs")
      .select("id, manager_id, action, entity_type, entity_id, old_value, new_value, created_at, profiles(email)", {
        count: "exact",
      })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (entityType) query = query.eq("entity_type", entityType);
    if (action) query = query.ilike("action", `%${action}%`);
    if (from) query = query.gte("created_at", `${from}T00:00:00`);
    if (to) query = query.lte("created_at", `${to}T23:59:59`);

    const { data, error, count } = await query;

    if (error) {
      console.error("Failed to fetch audit logs:", error.message);
      return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 });
    }

    const entries = (data ?? []).map((row) => ({
      id: row.id,
      managerEmail: (row.profiles as { email?: string } | null)?.email ?? "Unknown",
      action: row.action,
      entityType: row.entity_type,
      entityId: row.entity_id,
      oldValue: row.old_value,
      newValue: row.new_value,
      createdAt: row.created_at,
    }));

    return NextResponse.json({ entries, total: count ?? entries.length, limit, offset });
  } catch (err) {
    console.error("manager/audit-log route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
