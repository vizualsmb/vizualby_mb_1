import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseService } from "@/lib/supabase/service";
import { adminConfigured } from "@/lib/supabase/env";
import { devBypass } from "./dev";
import { createDemoClient } from "./demo/client";

export type AdminMode = "signed-in" | "dev-bypass-live" | "dev-bypass-demo";

// The authorization boundary for the admin. Every page and every server action calls
// this; the proxy's redirect is only a convenience. Queries made with the returned
// client are additionally limited by Row Level Security (public.is_admin()).
export const requireAdmin = cache(async () => {
  if (devBypass()) {
    // Local `next dev` only (see lib/admin/dev.ts). Real data if Supabase is configured, otherwise demo data.
    const service = createSupabaseService();
    if (service) return { supabase: service, userId: "00000000-0000-0000-0000-000000000000", email: "Local development", mode: "dev-bypass-live" as AdminMode };
    return { supabase: createDemoClient(), userId: "00000000-0000-0000-0000-000000000000", email: "Local development", mode: "dev-bypass-demo" as AdminMode };
  }
  if (!adminConfigured()) redirect("/admin/login?error=setup");
  const supabase = await createSupabaseServer();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;
  if (!userId) redirect("/admin/login");
  const { data: admin } = await supabase.from("admins").select("email").eq("user_id", userId).maybeSingle();
  if (!admin) redirect("/admin/login?error=unauthorized");
  return { supabase, userId, email: admin.email as string, mode: "signed-in" as AdminMode };
});
