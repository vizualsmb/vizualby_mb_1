"use server";

import { z } from "zod";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseService } from "@/lib/supabase/service";

export type LoginState = { step: "email" | "code"; email?: string; error?: string };

async function siteOrigin() {
  if (process.env.ADMIN_SITE_URL) return process.env.ADMIN_SITE_URL.replace(/\/$/, "");
  const h = await headers();
  return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
}

// Sends a one-time sign-in email (link + 6-digit code) only to allowlisted admins.
// The response is identical either way, so the form cannot be used to discover who is an admin.
export async function sendLoginCode(_: LoginState, fd: FormData): Promise<LoginState> {
  const email = z.email().max(160).safeParse(String(fd.get("email") ?? "").trim().toLowerCase());
  if (!email.success) return { step: "email", error: "Enter a valid email address." };
  const service = createSupabaseService();
  if (!service) return { step: "email", error: "The admin database is not configured yet." };
  const { data: admin } = await service.from("admins").select("user_id").eq("email", email.data).maybeSingle();
  if (admin) {
    const supabase = await createSupabaseServer();
    await supabase.auth.signInWithOtp({ email: email.data, options: { shouldCreateUser: false, emailRedirectTo: `${await siteOrigin()}/admin/auth/confirm` } });
  }
  return { step: "code", email: email.data };
}

export async function verifyLoginCode(_: LoginState, fd: FormData): Promise<LoginState> {
  const email = String(fd.get("email") ?? "");
  const token = String(fd.get("code") ?? "").replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { step: "code", email, error: "Enter the code from the email." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "That code is invalid or has expired. Request a new one." };
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
