"use client";

import { useActionState, useRef } from "react";
import { updateBookingStatus, type ActionState } from "@/lib/admin/actions";
import { BOOKING_STATUSES } from "@/lib/admin/labels";
import s from "./admin.module.css";

// Changes a booking's status as soon as a new one is picked. Without JavaScript,
// the Move button submits the same form.
export function StatusSelect({ id, status }: { id: string; status: string }) {
  const [state, action, pending] = useActionState<ActionState, FormData>(updateBookingStatus, {});
  const form = useRef<HTMLFormElement>(null);
  return <form ref={form} action={action} className={s.statusSelect}>
    <input type="hidden" name="id" value={id} />
    <select className={s.input} name="status" defaultValue={status} disabled={pending} aria-label="Move to status" onChange={() => form.current?.requestSubmit()}>
      {BOOKING_STATUSES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
    </select>
    <noscript><button className={`${s.button} ${s.buttonGhost}`}>Move</button></noscript>
    {state.error && <span className={s.formError} role="alert">{state.error}</span>}
  </form>;
}
