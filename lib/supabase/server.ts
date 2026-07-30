import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Used inside Server Components, Server Actions, and app/api route handlers.
// Reads/writes the auth session via cookies, so the logged-in user is known
// on the server without the client ever sending a token manually.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — safe to ignore because
            // middleware.ts (below) refreshes the session on every request.
          }
        },
      },
    }
  );
}

// A second client that uses the SERVICE ROLE key — bypasses RLS entirely.
// Only ever import this inside app/api/** route handlers that run on the
// server (never in Client Components, never in anything shipped to the
// browser). We'll use this in the login route to look up an Employee ID
// and to create/verify the linked auth user without RLS getting in the way.
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}