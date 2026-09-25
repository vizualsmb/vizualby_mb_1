import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "@/lib/supabase/env";

const PUBLIC_ADMIN_PATHS = ["/admin/login", "/admin/auth/"];

// Refreshes the Supabase session cookie and turns away signed-out visitors early.
// This is an optimistic check only: every admin page and action re-verifies the
// session and the admin allowlist on the server (lib/admin/auth.ts).
export async function proxy(request: NextRequest) {
  const env = supabaseEnv();
  const isPublic = PUBLIC_ADMIN_PATHS.some((p) => request.nextUrl.pathname.startsWith(p));
  if (!env) return isPublic ? NextResponse.next() : NextResponse.redirect(new URL("/admin/login", request.url));

  let response = NextResponse.next({ request });
  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(toSet, headers) {
        for (const { name, value } of toSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        for (const [key, value] of Object.entries(headers ?? {})) response.headers.set(key, value);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims && !isPublic) {
    const redirect = NextResponse.redirect(new URL("/admin/login", request.url));
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  }
  return response;
}

export const config = {
  matcher: ["/admin", "/admin/:path*", { source: "/", has: [{ type: "host", value: "admin.vizualbymb.com" }] }],
};
