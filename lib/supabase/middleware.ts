// lib/supabase/middleware.ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isAuthRoute = path.startsWith("/login") || path.startsWith("/set-password");
  const isManagerRoute = path.startsWith("/manager");
  const isResourceRoute = path.startsWith("/resource");

  // not logged in -> block protected routes
  if (!user && (isManagerRoute || isResourceRoute)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // logged in -> figure out role and enforce it
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const role = profile?.role;

    // logged-in user visiting login/set-password -> send to their dashboard
    if (isAuthRoute) {
      const url = request.nextUrl.clone();
      url.pathname = role === "manager" ? "/manager/dashboard" : "/resource/dashboard";
      return NextResponse.redirect(url);
    }

    // resource trying to access manager routes
    if (isManagerRoute && role !== "manager") {
      const url = request.nextUrl.clone();
      url.pathname = "/resource/dashboard";
      return NextResponse.redirect(url);
    }

    // manager trying to access resource routes
    if (isResourceRoute && role !== "resource") {
      const url = request.nextUrl.clone();
      url.pathname = "/manager/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return response;
}