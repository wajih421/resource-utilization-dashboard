// app/api/manager/tasks/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireManager(supabase: any) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "manager") return { error: "Manager access only", status: 403 };
  return { user };
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select(
        "id, name, ne_batch, default_hours, active, projects(id, name), task_categories(id, name)"
      )
      .order("name");

    if (error) {
      console.error("Failed to fetch tasks:", error.message);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    console.error("manager/tasks GET route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Update a task's default_hours, with audit logging
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { taskId, newHours } = await request.json();

    if (!taskId || newHours == null || Number(newHours) < 0) {
      return NextResponse.json(
        { error: "Valid taskId and newHours are required" },
        { status: 400 }
      );
    }

    const { data: existingTask, error: fetchErr } = await supabase
      .from("tasks")
      .select("default_hours")
      .eq("id", taskId)
      .single();

    if (fetchErr || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const oldHours = existingTask.default_hours;

    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ default_hours: newHours, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (updateErr) {
      console.error("Failed to update task hours:", updateErr.message);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    // audit log (best-effort, does not block the response if it fails)
    const { error: auditErr } = await supabase.from("audit_logs").insert({
      manager_id: auth.user.id,
      action: "update_task_default_hours",
      entity_type: "tasks",
      entity_id: taskId,
      old_value: { default_hours: oldHours },
      new_value: { default_hours: newHours },
    });

    if (auditErr) {
      console.error("Failed to write audit log:", auditErr.message);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("manager/tasks PATCH route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}