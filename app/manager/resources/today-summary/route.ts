// app/api/resource/today-summary/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || new Date().toISOString().slice(0, 10);

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

    const { data: logs, error } = await supabase
      .from("work_logs")
      .select(
        "id, units_completed, applied_task_hours, total_hours, work_day_type, projects(name), tasks(name)"
      )
      .eq("resource_id", profile.resource_id)
      .eq("work_date", date)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch today's work logs:", error.message);
      return NextResponse.json({ error: "Failed to fetch work logs" }, { status: 500 });
    }

    const totalHours = (logs ?? []).reduce(
      (sum, log) => sum + Number(log.total_hours),
      0
    );

    return NextResponse.json({ logs: logs ?? [], totalHours, date });
  } catch (err) {
    console.error("resource/today-summary route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}