"use client";

import { useState } from "react";
import s from "./admin.module.css";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return <div className={s.search} style={{ maxWidth: "none" }}>
    <input className={s.input} readOnly value={value} aria-label={label} onFocus={(e) => e.currentTarget.select()} />
    <button type="button" className={`${s.button} ${s.buttonGhost}`} onClick={async () => {
      try { await navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* the field stays selectable */ }
    }}>{copied ? "Copied" : "Copy"}</button>
  </div>;
}
