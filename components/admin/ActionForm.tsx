"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ActionState } from "@/lib/admin/actions";
import s from "./admin.module.css";

// Progressive server-action form: works without JavaScript, and with it shows
// pending state and the action's success or error message inline.
export function ActionForm({ action, children, submit, variant, resetOnSuccess, className, confirm }: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  children?: React.ReactNode; submit: string; variant?: "ghost" | "danger"; resetOnSuccess?: boolean; className?: string; confirm?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.ok && resetOnSuccess) ref.current?.reset(); }, [state, resetOnSuccess]);
  return <form ref={ref} action={formAction} className={className ?? s.form}
    onSubmit={confirm ? (e) => { if (!window.confirm(confirm)) e.preventDefault(); } : undefined}>
    {children}
    <div className={s.formFoot}>
      <button type="submit" disabled={pending} className={`${s.button} ${variant === "ghost" ? s.buttonGhost : variant === "danger" ? s.buttonDanger : ""}`}>{pending ? "Saving…" : submit}</button>
      <span aria-live="polite">
        {state.error && <span className={s.formError}>{state.error}</span>}
        {state.ok && state.message && <span className={s.formMessage}>{state.message}</span>}
      </span>
    </div>
  </form>;
}
