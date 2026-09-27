"use client";

import { useActionState } from "react";
import s from "@/components/admin/admin.module.css";
import { signInWithPassword, type LoginState } from "@/lib/admin/session-actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(signInWithPassword, {});

  return <form action={action} className={s.form}>
    <label className={s.field}>Email
      <input className={s.input} type="email" name="email" autoComplete="email" required autoFocus />
    </label>
    <label className={s.field}>Passcode
      <input className={s.input} type="password" name="password" autoComplete="current-password" required />
    </label>
    {state.error && <p className={s.formError} role="alert">{state.error}</p>}
    <div className={s.formFoot}><button className={s.button} disabled={pending}>{pending ? "Signing in…" : "Sign in"}</button></div>
  </form>;
}
