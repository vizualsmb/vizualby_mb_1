import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { adminConfigured } from "@/lib/supabase/env";

// The authorization boundary for the admin. Every page and every server action calls
// this; the proxy's redirect is only a convenience. Queries made with the returned
// client are additionally limited by Row Level Security (public.is_admin()).
export const requireAdmin = cache(async () => {
  if (!adminConfigured()) redirect("/admin/login?error=setup");
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/admin/login");
  const { data: admin } = await supabase.from("admins").select("email").eq("user_id", userId).maybeSingle();
  if (!admin) redirect("/admin/login?error=unauthorized");
  return { supabase, userId, email: admin.email as string };
});
