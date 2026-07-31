// app/api/resource/projects/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

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

    const { data, error } = await supabase
      .from("resource_projects")
      .select("project_id, projects(id, name)")
      .eq("resource_id", profile.resource_id)
      .eq("active", true);

    if (error) {
      console.error("Failed to fetch resource projects:", error.message);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    const projects = (data ?? []).map((row: any) => row.projects).filter(Boolean);

    return NextResponse.json({ projects });
  } catch (err) {
    console.error("resource/projects route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}