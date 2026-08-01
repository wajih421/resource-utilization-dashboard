// app/api/manager/attendance/route.ts
//
// Attendance rows are owned by the resource they belong to (RLS on
// attendance_logs allows a resource to read/write only its own row) —
// confirmed via a real cross-user write attempt during E2E testing, which
// failed with "new row violates row-level security policy for table
// attendance_logs" when using the manager's own session client. A manager
// legitimately needs to see and override every resource's attendance, which
// RLS built around single-resource self-service was never going to grant.
// So: authenticate/authorize with the manager's own session (requireManager,
// below), then perform the actual cross-resource reads/writes with the
// service-role client — the same pattern app/api/auth/set-password/route.ts
// already uses for its own admin-only operation.
import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/supabase/require-manager";
import { writeAuditLog } from "@/lib/supabase/audit-log";
import { computeAttendanceStatus } from "@/lib/utils/attendance";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const admin = createServiceRoleClient();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") ?? new Date().toISOString().slice(0, 10);

    const { data: resources, error: resErr } = await admin
      .from("resources")
      .select("id, name, employee_id, shift_start, shift_end")
      .eq("active", true)
      .order("name");

    if (resErr) {
      console.error("Failed to fetch resources:", resErr.message);
      return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
    }

    const { data: logs, error: logsErr } = await admin
      .from("attendance_logs")
      .select("resource_id, sign_in_time, sign_out_time, status")
      .eq("work_date", date);

    if (logsErr) {
      console.error("Failed to fetch attendance logs:", logsErr.message);
      return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
    }

    const logByResource = new Map((logs ?? []).map((l) => [l.resource_id, l]));

    const attendance = (resources ?? []).map((r) => {
      const log = logByResource.get(r.id);
      const status =
        log?.status === "on_leave"
          ? "on_leave"
          : computeAttendanceStatus({
              workDate: date,
              shiftStart: r.shift_start,
              shiftEnd: r.shift_end,
              signInTime: log?.sign_in_time ?? null,
              signOutTime: log?.sign_out_time ?? null,
              manuallyOnLeave: false,
            });

      return {
        id: r.id,
        name: r.name,
        employee_id: r.employee_id,
        shift_start: r.shift_start,
        shift_end: r.shift_end,
        sign_in_time: log?.sign_in_time ?? null,
        sign_out_time: log?.sign_out_time ?? null,
        status,
      };
    });

    return NextResponse.json({ attendance, date });
  } catch (err) {
    console.error("manager/attendance GET route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Manager override — marks a resource on_leave for a given date regardless
// of any sign-in/out already recorded.
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const admin = createServiceRoleClient();

    const { resourceId, date, status } = await request.json();
    if (!resourceId || !date || status !== "on_leave") {
      return NextResponse.json(
        { error: "resourceId, date and status ('on_leave') are required" },
        { status: 400 }
      );
    }

    const { data: existing, error: fetchErr } = await admin
      .from("attendance_logs")
      .select("*")
      .eq("resource_id", resourceId)
      .eq("work_date", date)
      .maybeSingle();

    if (fetchErr) {
      console.error("Failed to check existing attendance:", fetchErr.message);
      return NextResponse.json({ error: "Could not check attendance" }, { status: 500 });
    }

    const { error: writeErr } = existing
      ? await admin
          .from("attendance_logs")
          .update({ status: "on_leave", updated_at: new Date().toISOString() })
          .eq("id", existing.id)
      : await admin.from("attendance_logs").insert({
          resource_id: resourceId,
          work_date: date,
          status: "on_leave",
        });

    if (writeErr) {
      console.error("Failed to mark on leave:", writeErr.message);
      return NextResponse.json({ error: "Failed to mark on leave" }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      managerId: auth.user.id,
      action: "mark_on_leave",
      entityType: "attendance",
      entityId: resourceId,
      oldValue: existing ? { status: existing.status, work_date: date } : null,
      newValue: { status: "on_leave", work_date: date },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("manager/attendance POST route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
