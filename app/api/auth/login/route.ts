// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json(
        { error: "Both Employee ID and Password are Mandatory" },
        { status: 400 }
      );
    }

    const email = `${employeeId.trim().toLowerCase()}@rot-internal.local`;

    const supabase = await createClient();

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json(
        { error: "Employee ID or Password is wrong" },
        { status: 401 }
      );
    }

    // fetch profile to know role + whether custom password already set
    const { data: profile, error: profileErr } = await supabase
      .from("profiles")
      .select("role, has_custom_password")
      .eq("id", data.user.id)
      .single();

    if (profileErr || !profile) {
      return NextResponse.json(
        { error: "Cannot Find the profile! Contact admin plz" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      role: profile.role,
      needsPasswordSetup: !profile.has_custom_password,
    });
  } catch (err) {
    console.error("auth/login route error:", err);
    return NextResponse.json(
      { error: "Some unexpected error happened! Try again " },
      { status: 500 }
    );
  }
}