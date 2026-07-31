// app/api/manager/resources/route.ts
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

    const { data: resources, error: resErr } = await supabase
      .from("resources")
      .select("id, name, employee_id, resource_category, active")
      .order("name");

    if (resErr) {
      console.error("Failed to fetch resources:", resErr.message);
      return NextResponse.json({ error: "Failed to fetch resources" }, { status: 500 });
    }

    const { data: assignments, error: assignErr } = await supabase
      .from("resource_projects")
      .select("id, resource_id, project_id, active, projects(id, name)")
      .eq("active", true);

    if (assignErr) {
      console.error("Failed to fetch assignments:", assignErr.message);
      return NextResponse.json({ error: "Failed to fetch assignments" }, { status: 500 });
    }

    const assignmentsByResource = new Map<string, any[]>();
    for (const a of assignments ?? []) {
      const list = assignmentsByResource.get(a.resource_id) ?? [];
      list.push({
        assignmentId: a.id,
        projectId: a.project_id,
        projectName: (a.projects as any)?.name,
      });
      assignmentsByResource.set(a.resource_id, list);
    }

    const result = (resources ?? []).map((r) => ({
      ...r,
      assignedProjects: assignmentsByResource.get(r.id) ?? [],
    }));

    return NextResponse.json({ resources: result });
  } catch (err) {
    console.error("manager/resources route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}