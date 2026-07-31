// app/api/auth/set-password/route.ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Service-role client - only used server-side, bypasses RLS
const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

export async function POST(request: Request) {
  try {
    const { employeeId, newPassword } = await request.json();

    if (!employeeId || !newPassword) {
      return NextResponse.json(
        { error: "Employee ID aur new password dono zaroori hain" },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { error: "Password kam se kam 6 characters ka hona chahiye" },
        { status: 400 }
      );
    }

    const email = `${employeeId.trim().toLowerCase()}@rot-internal.local`;

    // find the profile (join resources by employee_id -> profile)
    const { data: resource, error: resErr } = await supabaseAdmin
      .from("resources")
      .select("id")
      .eq("employee_id", employeeId.trim())
      .single();

    if (resErr || !resource) {
      return NextResponse.json(
        { error: "Employee ID nahi mili" },
        { status: 404 }
      );
    }

    const { data: profile, error: profErr } = await supabaseAdmin
      .from("profiles")
      .select("id, has_custom_password")
      .eq("resource_id", resource.id)
      .single();

    if (profErr || !profile) {
      return NextResponse.json(
        { error: "Profile nahi mili, admin se contact karo" },
        { status: 404 }
      );
    }

    if (profile.has_custom_password) {
      return NextResponse.json(
        { error: "Password already set hai. Normal login page use karo." },
        { status: 400 }
      );
    }

    // update the auth user's password
    const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateErr) {
      console.error("Password update failed:", updateErr.message);
      return NextResponse.json(
        { error: "Password doesn't get set ! Try again" },
        { status: 500 }
      );
    }

    // mark as custom password set
    const { error: markErr } = await supabaseAdmin
      .from("profiles")
      .update({ has_custom_password: true })
      .eq("id", profile.id);

    if (markErr) {
      console.error("Failed to update has_custom_password flag:", markErr.message);
    }

    return NextResponse.json({ success: true, email });
  } catch (err) {
    console.error("set-password route error:", err);
    return NextResponse.json(
      { error: "Some unexpected error happened !! Try again" },
      { status: 500 }
    );
  }
}