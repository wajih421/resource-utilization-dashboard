// app/api/settings/route.ts
// Utilization settings (daily capacity + status thresholds) are shared
// config, readable by any logged-in user (resources need it to classify
// their own day) but only editable by managers.
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireAuth, requireManager } from "@/lib/supabase/require-manager";
import { writeAuditLog } from "@/lib/supabase/audit-log";
import type { TablesUpdate } from "@/types/database-types";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireAuth(supabase);
    if ("error" in auth) return auth.error;

    const { data, error } = await supabase
      .from("utilization_settings")
      .select("id, daily_capacity_hours, less_utilized_max, fully_utilized_max, highly_utilized_max")
      .single();

    if (error || !data) {
      console.error("Failed to load utilization_settings:", error?.message);
      return NextResponse.json({ error: "Could not load settings" }, { status: 500 });
    }

    return NextResponse.json({ settings: data });
  } catch (err) {
    console.error("settings GET route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const body = await request.json();
    const { daily_capacity_hours, less_utilized_max, fully_utilized_max, highly_utilized_max } = body as {
      daily_capacity_hours?: number;
      less_utilized_max?: number;
      fully_utilized_max?: number;
      highly_utilized_max?: number;
    };

    const patch: TablesUpdate<"utilization_settings"> = {};
    for (const [key, value] of Object.entries({
      daily_capacity_hours,
      less_utilized_max,
      fully_utilized_max,
      highly_utilized_max,
    }) as [keyof TablesUpdate<"utilization_settings">, number | undefined][]) {
      if (value == null) continue;
      const num = Number(value);
      if (isNaN(num) || num <= 0) {
        return NextResponse.json({ error: `${key} must be a positive number` }, { status: 400 });
      }
      patch[key] = num;
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const { data: existing, error: fetchErr } = await supabase
      .from("utilization_settings")
      .select("*")
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Settings row not found" }, { status: 404 });
    }

    // Merge with existing values so ordering can be validated against the
    // final state, not just whichever fields this request happened to touch.
    const merged = {
      less_utilized_max: patch.less_utilized_max ?? existing.less_utilized_max,
      fully_utilized_max: patch.fully_utilized_max ?? existing.fully_utilized_max,
      highly_utilized_max: patch.highly_utilized_max ?? existing.highly_utilized_max,
    };

    if (!(merged.less_utilized_max < merged.fully_utilized_max && merged.fully_utilized_max < merged.highly_utilized_max)) {
      return NextResponse.json(
        { error: "Thresholds must increase: less_utilized_max < fully_utilized_max < highly_utilized_max" },
        { status: 400 }
      );
    }

    const { data: updated, error: updateErr } = await supabase
      .from("utilization_settings")
      .update(patch)
      .eq("id", existing.id)
      .select()
      .single();

    if (updateErr) {
      console.error("Failed to update utilization_settings:", updateErr.message);
      return NextResponse.json({ error: "Failed to update settings" }, { status: 500 });
    }

    const oldChanged: Record<string, number> = {};
    const newChanged: Record<string, number> = {};
    for (const key of Object.keys(patch)) {
      const existingVal = (existing as Record<string, number>)[key];
      const patchVal = (patch as Record<string, number>)[key];
      if (existingVal !== patchVal) {
        oldChanged[key] = existingVal;
        newChanged[key] = patchVal;
      }
    }
    if (Object.keys(newChanged).length > 0) {
      // entity_id is a uuid column; utilization_settings has an integer PK
      // (it's a singleton config row), so there's nothing valid to put there.
      await writeAuditLog(supabase, {
        managerId: auth.user.id,
        action: "update_utilization_settings",
        entityType: "utilization_settings",
        entityId: null,
        oldValue: oldChanged,
        newValue: newChanged,
      });
    }

    return NextResponse.json({ settings: updated });
  } catch (err) {
    console.error("settings PATCH route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
