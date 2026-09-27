"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { createSupabaseService } from "@/lib/supabase/service";

export type LoginState = { error?: string };

async function approvedAdmin(email: string) {
  const service = createSupabaseService();
  if (!service) return { error: "The admin database is not configured yet." } as const;
  const { data: admin } = await service.from("admins").select("user_id").eq("email", email).maybeSingle();
  return admin ? { admin } as const : { error: "This email is not approved for the studio admin." } as const;
}

// Password authentication is still constrained by the studio admin allowlist.
// A generic failure message prevents this form from revealing approved accounts.
export async function signInWithPassword(_: LoginState, fd: FormData): Promise<LoginState> {
  const credentials = z.object({
    email: z.email().max(160),
    password: z.string().min(1).max(128),
  }).safeParse({
    email: String(fd.get("email") ?? "").trim().toLowerCase(),
    password: String(fd.get("password") ?? ""),
  });
  if (!credentials.success) return { error: "Enter your email and passcode." };

  const approval = await approvedAdmin(credentials.data.email);
  if ("error" in approval) return { error: "The email or passcode is incorrect." };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.auth.signInWithPassword(credentials.data);
  if (error || data.user?.id !== approval.admin.user_id) {
    if (data.session) await supabase.auth.signOut();
    return { error: "The email or passcode is incorrect." };
  }
  redirect("/admin");
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/admin/login");
}
