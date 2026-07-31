// app/api/work-logs/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, taskId, workDate, workDayType, unitsCompleted } = body;

    if (!projectId || !taskId || !workDate || !workDayType || unitsCompleted == null) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (Number(unitsCompleted) < 0) {
      return NextResponse.json({ error: "Units cannot be negative" }, { status: 400 });
    }

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

    // fetch the task's CURRENT default_hours to snapshot it into this log
    const { data: task, error: taskErr } = await supabase
      .from("tasks")
      .select("default_hours, project_id")
      .eq("id", taskId)
      .single();

    if (taskErr || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    if (task.project_id !== projectId) {
      return NextResponse.json(
        { error: "Task does not belong to the selected project" },
        { status: 400 }
      );
    }

    const appliedTaskHours = Number(task.default_hours);
    const totalHours = appliedTaskHours * Number(unitsCompleted);

    const { error: insertErr } = await supabase.from("work_logs").insert({
      resource_id: profile.resource_id,
      project_id: projectId,
      task_id: taskId,
      work_date: workDate,
      work_day_type: workDayType,
      units_completed: unitsCompleted,
      applied_task_hours: appliedTaskHours,
      total_hours: totalHours,
    });

    if (insertErr) {
      console.error("Failed to insert work log:", insertErr.message);
      return NextResponse.json(
        { error: "Failed to submit work log. Make sure you are assigned to this project." },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, totalHours });
  } catch (err) {
    console.error("work-logs route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}