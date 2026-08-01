import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database-types";

// Used inside Client Components ("use client" files) — e.g. forms,
// interactive dashboards. Reads the two public env vars from .env.local.
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}