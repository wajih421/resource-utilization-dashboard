// app/api/manager/tasks/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/supabase/require-manager";
import { writeAuditLog } from "@/lib/supabase/audit-log";
import type { TablesUpdate } from "@/types/database-types";

const TASK_SELECT =
  "id, name, ne_batch, default_hours, active, projects(id, name), task_categories(id, name)";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { data, error } = await supabase.from("tasks").select(TASK_SELECT).order("name");

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

// Create a new task under a project + category
export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { project_id, task_category_id, name, ne_batch, default_hours } = await request.json();

    if (!project_id || !task_category_id || !name || default_hours == null) {
      return NextResponse.json(
        { error: "project_id, task_category_id, name and default_hours are required" },
        { status: 400 }
      );
    }
    if (Number(default_hours) <= 0) {
      return NextResponse.json({ error: "default_hours must be greater than 0" }, { status: 400 });
    }

    const { data: newTask, error: insertErr } = await supabase
      .from("tasks")
      .insert({
        project_id,
        task_category_id,
        name,
        ne_batch: ne_batch ?? null,
        default_hours,
        active: true,
      })
      .select(TASK_SELECT)
      .single();

    if (insertErr) {
      console.error("Failed to create task:", insertErr.message);
      return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      managerId: auth.user.id,
      action: "create_task",
      entityType: "tasks",
      entityId: newTask.id,
      oldValue: null,
      newValue: newTask,
    });

    return NextResponse.json({ task: newTask }, { status: 201 });
  } catch (err) {
    console.error("manager/tasks POST route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Update task fields. default_hours changes are always audit-logged since
// they affect future WorkLog calculations (past logs store their own
// applied_task_hours and are untouched by this).
export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { taskId, ...updates } = await request.json();
    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const allowedFields = ["name", "ne_batch", "default_hours", "project_id", "task_category_id", "active"] as const;
    const patch: TablesUpdate<"tasks"> = {};
    for (const key of allowedFields) {
      if (key in updates) (patch as Record<string, unknown>)[key] = updates[key];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    if ("default_hours" in patch && Number(patch.default_hours) <= 0) {
      return NextResponse.json({ error: "default_hours must be greater than 0" }, { status: 400 });
    }

    const { data: existingTask, error: fetchErr } = await supabase
      .from("tasks")
      .select("*")
      .eq("id", taskId)
      .single();

    if (fetchErr || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    patch.updated_at = new Date().toISOString();

    const { data: updatedTask, error: updateErr } = await supabase
      .from("tasks")
      .update(patch)
      .eq("id", taskId)
      .select(TASK_SELECT)
      .single();

    if (updateErr) {
      console.error("Failed to update task:", updateErr.message);
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    // Only log fields that actually changed
    const oldChanged: Record<string, unknown> = {};
    const newChanged: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      if (key === "updated_at") continue;
      const existingVal = (existingTask as Record<string, unknown>)[key];
      const patchVal = (patch as Record<string, unknown>)[key];
      if (existingVal !== patchVal) {
        oldChanged[key] = existingVal;
        newChanged[key] = patchVal;
      }
    }
    if (Object.keys(newChanged).length > 0) {
      await writeAuditLog(supabase, {
        managerId: auth.user.id,
        action: "update_task",
        entityType: "tasks",
        entityId: taskId,
        oldValue: oldChanged,
        newValue: newChanged,
      });
    }

    return NextResponse.json({ task: updatedTask });
  } catch (err) {
    console.error("manager/tasks PATCH route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Soft-delete only. We never hard-delete a task: WorkLogs reference task_id
// as a foreign key, and historical logs must remain intact and queryable
// even after a task is retired (SRS section 25: "Inactive task" edge case).
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const taskId = searchParams.get("taskId");
    if (!taskId) {
      return NextResponse.json({ error: "taskId is required" }, { status: 400 });
    }

    const { data: existingTask, error: fetchErr } = await supabase
      .from("tasks")
      .select("active")
      .eq("id", taskId)
      .single();

    if (fetchErr || !existingTask) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const { error: updateErr } = await supabase
      .from("tasks")
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq("id", taskId);

    if (updateErr) {
      console.error("Failed to deactivate task:", updateErr.message);
      return NextResponse.json({ error: "Failed to deactivate task" }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      managerId: auth.user.id,
      action: "deactivate_task",
      entityType: "tasks",
      entityId: taskId,
      oldValue: { active: existingTask.active },
      newValue: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("manager/tasks DELETE route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
