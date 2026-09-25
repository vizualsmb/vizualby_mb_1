"use client";

import s from "@/components/admin/admin.module.css";

export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const offline = typeof navigator !== "undefined" && !navigator.onLine;
  return <div className={s.card} role="alert">
    <p className={s.eyebrow}>{offline ? "Offline" : "Something went wrong"}</p>
    <h1 className={s.title}>{offline ? "You’re offline" : "We couldn’t load this page"}</h1>
    <p className={s.subtitle}>{offline ? "Reconnect and try again. Nothing was lost." : "The database or a provider did not respond. Your data is safe; try again in a moment."}</p>
    {error.digest && <p className={s.metaText} style={{ marginTop: 10 }}>Reference: {error.digest}</p>}
    <div className={s.formFoot} style={{ marginTop: 18 }}><button className={s.button} onClick={reset}>Try again</button></div>
  </div>;
}
