// app/api/resource/tasks/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get("projectId");

    if (!projectId) {
      return NextResponse.json({ error: "projectId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("tasks")
      .select("id, name, ne_batch, default_hours, task_categories(id, name)")
      .eq("project_id", projectId)
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Failed to fetch tasks:", error.message);
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    return NextResponse.json({ tasks: data ?? [] });
  } catch (err) {
    console.error("resource/tasks route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}