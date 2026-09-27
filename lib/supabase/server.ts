import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

// A client acting as the signed-in user: every query goes through Row Level Security.
export async function createSupabaseServer() {
  const env = supabaseEnv();
  if (!env) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(env.url, env.publishableKey, {
    db: { schema: "studio_admin" },
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(toSet) {
        // Server Components cannot write cookies; the proxy refreshes the session instead.
        try { for (const { name, value, options } of toSet) cookieStore.set(name, value, options); } catch {}
      },
    },
  });
}
