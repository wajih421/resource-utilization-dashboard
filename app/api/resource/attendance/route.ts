// app/api/resource/attendance/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { computeAttendanceStatus } from "@/lib/utils/attendance";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("resource_id")
      .eq("id", user.id)
      .single();

    if (!profile?.resource_id) {
      return NextResponse.json({ error: "No linked resource found" }, { status: 404 });
    }

    const date = todayStr();

    const { data: log, error } = await supabase
      .from("attendance_logs")
      .select("sign_in_time, sign_out_time, status")
      .eq("resource_id", profile.resource_id)
      .eq("work_date", date)
      .maybeSingle();

    if (error) {
      console.error("Failed to fetch attendance:", error.message);
      return NextResponse.json({ error: "Failed to fetch attendance" }, { status: 500 });
    }

    return NextResponse.json({ attendance: log ?? null });
  } catch (err) {
    console.error("resource/attendance GET route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("resource_id")
      .eq("id", user.id)
      .single();

    if (!profile?.resource_id) {
      return NextResponse.json({ error: "No linked resource found" }, { status: 404 });
    }

    const { action } = await request.json();
    if (action !== "sign-in" && action !== "sign-out") {
      return NextResponse.json({ error: "action must be 'sign-in' or 'sign-out'" }, { status: 400 });
    }

    const { data: resource, error: resErr } = await supabase
      .from("resources")
      .select("shift_start, shift_end")
      .eq("id", profile.resource_id)
      .single();

    if (resErr || !resource) {
      return NextResponse.json({ error: "Resource not found" }, { status: 404 });
    }

    const date = todayStr();
    const now = new Date().toISOString();

    const { data: existing, error: existingErr } = await supabase
      .from("attendance_logs")
      .select("*")
      .eq("resource_id", profile.resource_id)
      .eq("work_date", date)
      .maybeSingle();

    if (existingErr) {
      console.error("Failed to check existing attendance:", existingErr.message);
      return NextResponse.json({ error: "Could not check attendance" }, { status: 500 });
    }

    if (existing?.status === "on_leave") {
      return NextResponse.json(
        { error: "You are marked on leave today — contact your manager to change this" },
        { status: 409 }
      );
    }

    if (action === "sign-in") {
      if (existing?.sign_in_time) {
        return NextResponse.json({ error: "You have already signed in today" }, { status: 409 });
      }

      const status = computeAttendanceStatus({
        workDate: date,
        shiftStart: resource.shift_start,
        shiftEnd: resource.shift_end,
        signInTime: now,
        signOutTime: null,
        manuallyOnLeave: false,
      });

      // No unique constraint on (resource_id, work_date) to lean on, so
      // insert-if-missing / update-if-present explicitly rather than upsert.
      const { data: saved, error: writeErr } = existing
        ? await supabase
            .from("attendance_logs")
            .update({ sign_in_time: now, status, updated_at: now })
            .eq("id", existing.id)
            .select("sign_in_time, sign_out_time, status")
            .single()
        : await supabase
            .from("attendance_logs")
            .insert({ resource_id: profile.resource_id, work_date: date, sign_in_time: now, status })
            .select("sign_in_time, sign_out_time, status")
            .single();

      if (writeErr) {
        console.error("Failed to sign in:", writeErr.message);
        return NextResponse.json({ error: "Failed to sign in" }, { status: 500 });
      }

      return NextResponse.json({ attendance: saved });
    }

    // sign-out
    if (!existing?.sign_in_time) {
      return NextResponse.json({ error: "You need to sign in before signing out" }, { status: 409 });
    }
    if (existing.sign_out_time) {
      return NextResponse.json({ error: "You have already signed out today" }, { status: 409 });
    }

    const status = computeAttendanceStatus({
      workDate: date,
      shiftStart: resource.shift_start,
      shiftEnd: resource.shift_end,
      signInTime: existing.sign_in_time,
      signOutTime: now,
      manuallyOnLeave: false,
    });

    const { data: saved, error: updateErr } = await supabase
      .from("attendance_logs")
      .update({ sign_out_time: now, status, updated_at: now })
      .eq("id", existing.id)
      .select("sign_in_time, sign_out_time, status")
      .single();

    if (updateErr) {
      console.error("Failed to sign out:", updateErr.message);
      return NextResponse.json({ error: "Failed to sign out" }, { status: 500 });
    }

    return NextResponse.json({ attendance: saved });
  } catch (err) {
    console.error("resource/attendance POST route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
