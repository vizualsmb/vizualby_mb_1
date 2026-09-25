import type { Metadata } from "next";
import s from "@/components/admin/admin.module.css";
import { Brand } from "@/components/admin/AdminNav";
import { Notice } from "@/components/admin/ui";
import { signOut } from "@/lib/admin/session-actions";
import { LoginForm } from "./LoginForm";
import { redirect } from "next/navigation";
import { devBypass } from "@/lib/admin/dev";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  unauthorized: "This account is signed in but is not approved for the admin. Sign out and use the studio account.",
  link: "That sign-in link is invalid or has expired. Request a new one below.",
  setup: "The admin database is not connected yet. Add the Supabase settings described in docs/ADMIN.md.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  if (devBypass()) redirect("/admin");
  return <main className={s.auth} id="main-content">
    <div className={s.authCard}>
      <Brand />
      <div><p className={s.eyebrow}>Private</p><h1 className={s.title}>Studio sign in</h1>
        <p className={s.subtitle}>We’ll email you a one-time sign-in link and code. No password to remember.</p></div>
      {error && ERRORS[error] && <Notice tone="bad">{ERRORS[error]}</Notice>}
      {error === "unauthorized"
        ? <form action={signOut}><button className={s.button}>Sign out</button></form>
        : <LoginForm />}
    </div>
  </main>;
}
