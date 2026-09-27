import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseEnv } from "./env";

// Bypasses Row Level Security. Only for verified webhooks and pre-auth checks on the server.
export function createSupabaseService() {
  const env = supabaseEnv();
  const secret = process.env.SUPABASE_SECRET_KEY;
  if (!env || !secret) return null;
  return createClient(env.url, secret, {
    db: { schema: "studio_admin" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export type AdminSupabaseClient = NonNullable<ReturnType<typeof createSupabaseService>>;
