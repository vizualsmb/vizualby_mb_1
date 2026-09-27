"use client";

import { Crosshair } from "lucide-react";
import { useTransition } from "react";
import { toggleProjectFocus } from "@/lib/admin/production-actions";
import s from "./admin.module.css";

export function FocusToggle({ projectId, focused }: { projectId: string; focused: boolean }) {
  const [pending, startTransition] = useTransition();
  return <button type="button" className={`${s.focusToggle} ${focused ? s.focusToggleActive : ""}`} aria-label={focused ? "Remove project from focus" : "Set project as focus"} aria-pressed={focused} disabled={pending} onClick={() => startTransition(() => { void toggleProjectFocus(projectId, !focused); })}><Crosshair size={16} /></button>;
}
