// proxy.ts
// Next.js 16 renamed Middleware to Proxy (same functionality, see
// https://nextjs.org/docs/messages/middleware-to-proxy) — this project
// pins a version where `middleware.ts` still worked but was flagged as
// deprecated at build time, so it's named per the new convention here.
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Run on every route except static files and images
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
