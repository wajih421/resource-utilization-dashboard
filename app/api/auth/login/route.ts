// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const { employeeId, password } = await request.json();

    if (!employeeId || !password) {
      return NextResponse.json(
        { error: "Employee ID aur password dono zaroori hain" },
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
        { error: "Employee ID ya password galat hai" },
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
        { error: "Profile nahi mili, admin se contact karo" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      role: profile.role,
      needsPasswordSetup: !profile.has_custom_password,
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Kuch galat ho gaya, dobara try karo" },
      { status: 500 }
    );
  }
}