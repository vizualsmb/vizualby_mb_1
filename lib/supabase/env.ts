// Server-only configuration. None of these are NEXT_PUBLIC_: the admin never talks
// to Supabase from the browser, so no key ships in client JavaScript.
export function supabaseEnv() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export function adminConfigured() {
  return !!supabaseEnv() && !!process.env.SUPABASE_SECRET_KEY;
}
