// app/api/manager/assign-project/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function requireManager(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileErr || profile?.role !== "manager") {
    return { error: NextResponse.json({ error: "Not authorized" }, { status: 403 }) };
  }

  return { user };
}

// POST { resourceId, projectId } -> adds a new active assignment.
// Resources can be assigned to MULTIPLE projects at once (matches the
// resources page UI, which shows assigned projects as removable chips).
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireManager(supabase);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const { resourceId, projectId } = body as { resourceId?: string; projectId?: string };

  if (!resourceId || !projectId) {
    return NextResponse.json(
      { error: "resourceId and projectId are required" },
      { status: 400 }
    );
  }

  // Already actively assigned to this exact project? Don't duplicate.
  const { data: existing, error: existingErr } = await supabase
    .from("resource_projects")
    .select("id, active")
    .eq("resource_id", resourceId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (existingErr) {
    console.error("Failed to check existing assignment:", existingErr);
    return NextResponse.json({ error: "Could not check existing assignment" }, { status: 500 });
  }

  if (existing?.active) {
    return NextResponse.json({ error: "Resource is already assigned to this project" }, { status: 409 });
  }

  if (existing) {
    // Was assigned before, then removed -> reactivate instead of duplicating the row
    const { error: reactivateErr } = await supabase
      .from("resource_projects")
      .update({ active: true, assigned_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (reactivateErr) {
      console.error("Failed to reactivate assignment:", reactivateErr);
      return NextResponse.json({ error: "Could not assign project" }, { status: 500 });
    }
  } else {
    const { error: insertErr } = await supabase.from("resource_projects").insert({
      resource_id: resourceId,
      project_id: projectId,
      active: true,
      assigned_at: new Date().toISOString(),
    });

    if (insertErr) {
      console.error("Failed to create assignment:", insertErr);
      return NextResponse.json({ error: "Could not assign project" }, { status: 500 });
    }
  }

  await supabase.from("audit_logs").insert({
    manager_id: user!.id,
    action: "assign_project",
    entity_type: "resource",
    entity_id: resourceId,
    old_value: null,
    new_value: { project_id: projectId },
  });

  return NextResponse.json({ success: true });
}

// DELETE { assignmentId } -> removes one specific assignment (soft delete,
// sets active=false so the audit trail / history isn't lost).
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const auth = await requireManager(supabase);
  if (auth.error) return auth.error;
  const { user } = auth;

  const body = await request.json();
  const { assignmentId } = body as { assignmentId?: string };

  if (!assignmentId) {
    return NextResponse.json({ error: "assignmentId is required" }, { status: 400 });
  }

  const { data: assignment, error: fetchErr } = await supabase
    .from("resource_projects")
    .select("id, resource_id, project_id")
    .eq("id", assignmentId)
    .single();

  if (fetchErr || !assignment) {
    return NextResponse.json({ error: "Assignment not found" }, { status: 404 });
  }

  const { error: updateErr } = await supabase
    .from("resource_projects")
    .update({ active: false })
    .eq("id", assignmentId);

  if (updateErr) {
    console.error("Failed to remove assignment:", updateErr);
    return NextResponse.json({ error: "Could not remove assignment" }, { status: 500 });
  }

  await supabase.from("audit_logs").insert({
    manager_id: user!.id,
    action: "remove_project_assignment",
    entity_type: "resource",
    entity_id: assignment.resource_id,
    old_value: { project_id: assignment.project_id },
    new_value: null,
  });

  return NextResponse.json({ success: true });
}