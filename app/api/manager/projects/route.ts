// app/api/manager/projects/route.ts
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

    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .eq("active", true)
      .order("name");

    if (error) {
      console.error("Failed to fetch projects:", error.message);
      return NextResponse.json({ error: "Failed to fetch projects" }, { status: 500 });
    }

    return NextResponse.json({ projects: data ?? [] });
  } catch (err) {
    console.error("manager/projects route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}