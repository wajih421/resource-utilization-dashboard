// app/api/manager/projects/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/supabase/require-manager";
import { writeAuditLog } from "@/lib/supabase/audit-log";
import type { TablesUpdate } from "@/types/database-types";

// GET is also used by non-management screens (task creation's project
// dropdown, the resources page's assign-project dropdown) which should only
// ever see active projects — hence the default filter. The Projects
// management page passes ?includeInactive=true to see everything.
export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let query = supabase.from("projects").select("id, name, active, created_at").order("name");
    if (!includeInactive) {
      query = query.eq("active", true);
    }
    const { data: projects, error } = await query;

    if (error) {
      console.error("Failed to fetch projects:", error.message);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    if (!includeInactive) {
      return NextResponse.json({ projects: projects ?? [] });
    }

    // Management view: enrich with assigned-resource counts.
    const { data: assignments, error: assignErr } = await supabase
      .from("resource_projects")
      .select("project_id")
      .eq("active", true);

    if (assignErr) {
      console.error("Failed to fetch assignment counts:", assignErr.message);
      return NextResponse.json({ error: "Failed to fetch assignment counts" }, { status: 500 });
    }

    const countByProject = new Map<string, number>();
    for (const a of assignments ?? []) {
      countByProject.set(a.project_id, (countByProject.get(a.project_id) ?? 0) + 1);
    }

    const enriched = (projects ?? []).map((p) => ({
      ...p,
      assignedResourceCount: countByProject.get(p.id) ?? 0,
    }));

    return NextResponse.json({ projects: enriched });
  } catch (err) {
    console.error("manager/projects GET route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { name } = await request.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ error: "Project name is required" }, { status: 400 });
    }

    const { data: newProject, error: insertErr } = await supabase
      .from("projects")
      .insert({ name: String(name).trim(), active: true })
      .select()
      .single();

    if (insertErr) {
      console.error("Failed to create project:", insertErr.message);
      return NextResponse.json(
        { error: "Failed to create project (it may already exist)" },
        { status: 400 }
      );
    }

    await writeAuditLog(supabase, {
      managerId: auth.user.id,
      action: "create_project",
      entityType: "projects",
      entityId: newProject.id,
      oldValue: null,
      newValue: newProject,
    });

    return NextResponse.json({ project: newProject }, { status: 201 });
  } catch (err) {
    console.error("manager/projects POST route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { projectId, ...updates } = await request.json();
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const allowedFields = ["name", "active"] as const;
    const patch: TablesUpdate<"projects"> = {};
    for (const key of allowedFields) {
      if (key in updates) (patch as Record<string, unknown>)[key] = updates[key];
    }
    if (Object.keys(patch).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }
    if ("name" in patch && !String(patch.name).trim()) {
      return NextResponse.json({ error: "Project name cannot be empty" }, { status: 400 });
    }

    const { data: existingProject, error: fetchErr } = await supabase
      .from("projects")
      .select("*")
      .eq("id", projectId)
      .single();

    if (fetchErr || !existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { data: updatedProject, error: updateErr } = await supabase
      .from("projects")
      .update(patch)
      .eq("id", projectId)
      .select()
      .single();

    if (updateErr) {
      console.error("Failed to update project:", updateErr.message);
      return NextResponse.json({ error: "Failed to update project" }, { status: 500 });
    }

    const oldChanged: Record<string, unknown> = {};
    const newChanged: Record<string, unknown> = {};
    for (const key of Object.keys(patch)) {
      const existingVal = (existingProject as Record<string, unknown>)[key];
      const patchVal = (patch as Record<string, unknown>)[key];
      if (existingVal !== patchVal) {
        oldChanged[key] = existingVal;
        newChanged[key] = patchVal;
      }
    }
    if (Object.keys(newChanged).length > 0) {
      await writeAuditLog(supabase, {
        managerId: auth.user.id,
        action: "update_project",
        entityType: "projects",
        entityId: projectId,
        oldValue: oldChanged,
        newValue: newChanged,
      });
    }

    return NextResponse.json({ project: updatedProject });
  } catch (err) {
    console.error("manager/projects PATCH route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

// Soft-delete only — projects are FK-referenced by tasks, resource_projects
// and work_logs, so historical data must stay intact after a project ends.
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");
    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const { data: existingProject, error: fetchErr } = await supabase
      .from("projects")
      .select("active")
      .eq("id", projectId)
      .single();

    if (fetchErr || !existingProject) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const { error: updateErr } = await supabase
      .from("projects")
      .update({ active: false })
      .eq("id", projectId);

    if (updateErr) {
      console.error("Failed to deactivate project:", updateErr.message);
      return NextResponse.json({ error: "Failed to deactivate project" }, { status: 500 });
    }

    await writeAuditLog(supabase, {
      managerId: auth.user.id,
      action: "deactivate_project",
      entityType: "projects",
      entityId: projectId,
      oldValue: { active: existingProject.active },
      newValue: { active: false },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("manager/projects DELETE route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
