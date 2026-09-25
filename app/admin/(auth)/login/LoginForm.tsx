"use client";

import { useActionState } from "react";
import s from "@/components/admin/admin.module.css";
import { sendLoginCode, verifyLoginCode, type LoginState } from "@/lib/admin/session-actions";

export function LoginForm() {
  const [sent, send, sending] = useActionState<LoginState, FormData>(sendLoginCode, { step: "email" });
  const [verified, verify, verifying] = useActionState<LoginState, FormData>(verifyLoginCode, { step: "code" });

  if (sent.step === "code") return <form action={verify} className={s.form}>
    <p className={s.subtitle} role="status">If <b>{sent.email}</b> is an approved admin, a sign-in email is on its way. Open the link on this device, or enter the code here.</p>
    <input type="hidden" name="email" value={sent.email} />
    <label className={s.field}>Sign-in code
      <input className={s.input} name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]{6,12}" required autoFocus />
    </label>
    {verified.error && <p className={s.formError} role="alert">{verified.error}</p>}
    <div className={s.formFoot}><button className={s.button} disabled={verifying}>{verifying ? "Checking…" : "Sign in"}</button></div>
  </form>;

  return <form action={send} className={s.form}>
    <label className={s.field}>Email
      <input className={s.input} type="email" name="email" autoComplete="email" required autoFocus />
    </label>
    {sent.error && <p className={s.formError} role="alert">{sent.error}</p>}
    <div className={s.formFoot}><button className={s.button} disabled={sending}>{sending ? "Sending…" : "Email me a sign-in link"}</button></div>
  </form>;
}
