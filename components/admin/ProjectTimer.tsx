"use client";

import { useEffect, useState, useTransition } from "react";
import { Pause, Play, Square } from "lucide-react";
import { useRouter } from "next/navigation";
import { pauseProjectTimer, resumeProjectTimer, startProjectTimer, stopProjectTimer } from "@/lib/admin/production-actions";
import type { TimeCategory, TimeSession } from "@/lib/admin/production";
import s from "./admin.module.css";

const format = (seconds: number) => [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60].map((n) => String(n).padStart(2, "0")).join(":");

export function ProjectTimer({ projectId, session }: { projectId: string; session: TimeSession | null }) {
  const router = useRouter();
  const [now, setNow] = useState(0);
  const [category, setCategory] = useState<TimeCategory>(session?.category ?? "editing");
  const [pending, run] = useTransition();
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { const id = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(id); }, []);
  const seconds = (session?.duration_seconds ?? 0) + (session?.active_started_at ? Math.max(0, Math.floor((now - Date.parse(session.active_started_at)) / 1000)) : 0);
  const invoke = (fn: () => Promise<{ ok: boolean; error?: string }>) => run(async () => { setError(null); const result = await fn(); if (!result.ok) setError(result.error ?? "Could not update timer."); router.refresh(); });
  return <section className={s.projectTimer} aria-label="Editing timer">
    <p className={s.projectTimerLabel}>Session time</p><strong>{format(seconds)}</strong><p className={s.projectTimerStatus}><i />{session?.active_started_at ? "Recording" : session ? "Paused" : "Ready to track"}</p>
    {!session && <label className={s.projectTimerCategory}>Work type<select value={category} onChange={(e) => setCategory(e.target.value as TimeCategory)} disabled={pending}><option value="editing">Editing</option><option value="vfx">VFX</option><option value="color">Color</option><option value="sound">Sound</option><option value="revisions">Revisions</option><option value="other">Other</option></select></label>}
    <div className={s.projectTimerControls}>{!session ? <button className={s.productionPrimaryButton} type="button" disabled={pending} onClick={() => invoke(() => startProjectTimer(projectId, category))}><Play size={16} fill="currentColor" />Start</button> : session.active_started_at ? <><button className={s.projectTimerPause} type="button" disabled={pending} onClick={() => invoke(() => pauseProjectTimer(session.id))}><Pause size={18} fill="currentColor" />Pause</button><button className={s.projectTimerStop} type="button" disabled={pending} onClick={() => invoke(() => stopProjectTimer(session.id))}><Square size={15} />Stop</button></> : <><button className={s.productionPrimaryButton} type="button" disabled={pending} onClick={() => invoke(() => resumeProjectTimer(session.id))}><Play size={16} fill="currentColor" />Resume</button><button className={s.projectTimerStop} type="button" disabled={pending} onClick={() => invoke(() => stopProjectTimer(session.id))}><Square size={15} />Stop</button></>}</div>
    {error && <p className={s.formError} role="alert">{error}</p>}</section>;
}
