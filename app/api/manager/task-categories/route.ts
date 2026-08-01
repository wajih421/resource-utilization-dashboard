// app/api/manager/task-categories/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireManager } from "@/lib/supabase/require-manager";
import { writeAuditLog } from "@/lib/supabase/audit-log";

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { data, error } = await supabase
      .from("task_categories")
      .select("id, name")
      .order("name");

    if (error) {
      console.error("Failed to fetch task categories:", error.message);
      return NextResponse.json({ error: "Failed to fetch task categories" }, { status: 500 });
    }

    return NextResponse.json({ categories: data ?? [] });
  } catch (err) {
    console.error("manager/task-categories GET route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await requireManager(supabase);
    if ("error" in auth) return auth.error;

    const { name } = await request.json();
    if (!name || !name.trim()) {
      return NextResponse.json({ error: "Category name is required" }, { status: 400 });
    }

    const { data: newCategory, error: insertErr } = await supabase
      .from("task_categories")
      .insert({ name: name.trim() })
      .select()
      .single();

    if (insertErr) {
      console.error("Failed to create task category:", insertErr.message);
      return NextResponse.json(
        { error: "Failed to create category (it may already exist)" },
        { status: 400 }
      );
    }

    await writeAuditLog(supabase, {
      managerId: auth.user.id,
      action: "create_task_category",
      entityType: "task_categories",
      entityId: newCategory.id,
      oldValue: null,
      newValue: newCategory,
    });

    return NextResponse.json({ category: newCategory }, { status: 201 });
  } catch (err) {
    console.error("manager/task-categories POST route error:", err);
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
