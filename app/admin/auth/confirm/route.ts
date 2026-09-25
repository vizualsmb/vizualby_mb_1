import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";

// Landing point for the sign-in email link. Supports both the token-hash link
// and the PKCE code flow, depending on how the Supabase email template is set.
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;
  const code = params.get("code");
  let ok = false;
  try {
    const supabase = await createSupabaseServer();
    if (tokenHash && (type === "email" || type === "magiclink")) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;
    else if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  } catch { ok = false; }
  return NextResponse.redirect(new URL(ok ? "/admin" : "/admin/login?error=link", request.url));
}
