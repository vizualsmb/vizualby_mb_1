"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, ExternalLink, LoaderCircle, PackageCheck, TriangleAlert } from "lucide-react";
import type { Shoot, ShootItem } from "@/lib/admin/pre-shoot";
import { initializeFinalChecks, setFinalCheck, setShootItem } from "@/lib/admin/pre-shoot-actions";
import s from "./admin.module.css";

type FinalCheck = { item: string; checked: boolean; sort_order: number };
export function PreShootFlow({ shoot, items, initialChecks }: { shoot: Shoot; items: ShootItem[]; initialChecks: FinalCheck[] }) {
  const [pending, start] = useTransition(); const [stage, setStage] = useState(shoot.stage); const [checks, setChecks] = useState(initialChecks);
  useEffect(() => { if (!checks.length) start(async () => { await initializeFinalChecks(shoot.id); location.reload(); }); }, [checks.length, shoot.id]);
  const packed = items.filter((x) => x.packed).length, loaded = items.filter((x) => x.loaded).length, requiredMissing = items.filter((x) => x.shoot_required && (!x.packed || !x.loaded));
  const pct = items.length ? Math.round(((packed + loaded) / (items.length * 2)) * 100) : 0;
  const ready = items.length > 0 && loaded === items.length && !requiredMissing.length && checks.length > 0 && checks.every((x) => x.checked);
  const toggleGear = (id: string, field: "packed" | "loaded", value: boolean) => start(async () => { await setShootItem(shoot.id, id, field, value); location.reload(); });
  const toggleFinal = (c: FinalCheck) => { setChecks((rows) => rows.map((x) => x.sort_order === c.sort_order ? { ...x, checked: !x.checked } : x)); start(async () => { const result = await setFinalCheck(shoot.id, c.sort_order, !c.checked); if (!result.ok) location.reload(); }); };
  if (ready) return <section className={s.readyScreen}><span><Check size={30} /></span><p>Pre-shoot complete</p><h1>READY FOR SHOOT</h1><h2>{shoot.name}</h2><div className={s.readyList}><b>Equipment Packed <Check size={16} /></b><b>Equipment Loaded <Check size={16} /></b><b>Final Check <Check size={16} /></b></div><Link className={s.button} href="/admin/pre-shoot">Done</Link></section>;
  return <div className={s.preShootPage}>
    <header className={s.preShootHeader}><div><p className={s.eyebrow}>Pre-shoot</p><h1>{shoot.name}</h1><p>{new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(shoot.shoot_at))}{shoot.location ? ` · ${shoot.location}` : ""}</p></div>{shoot.shot_list_url && <a className={`${s.button} ${s.buttonGhost}`} href={shoot.shot_list_url} target="_blank" rel="noreferrer">Shot list <ExternalLink size={14} /></a>}</header>
    <div className={s.preShootSticky}><div><b>{pct}% ready</b><span>{packed + loaded} / {items.length * 2} checks</span></div><i><span style={{ width: `${pct}%` }} /></i></div>
    {requiredMissing.length > 0 && <div className={`${s.notice} ${s.noticeBad}`}><TriangleAlert size={17} /><span><b>{requiredMissing.length} required {requiredMissing.length === 1 ? "item" : "items"} missing</b><br />{requiredMissing.map((x) => x.name).join(", ")}</span></div>}
    <div className={s.preShootStages}><button className={stage === "pack" ? s.preShootStageActive : ""} onClick={() => setStage("pack")}>1 <span>Pack</span></button><button className={stage === "load" ? s.preShootStageActive : ""} onClick={() => setStage("load")}>2 <span>Load</span></button><button className={stage === "final" ? s.preShootStageActive : ""} onClick={() => setStage("final")}>3 <span>Final</span></button><button className={stage === "ready" ? s.preShootStageActive : ""} onClick={() => setStage("ready")}>4 <span>Ready</span></button></div>
    {(stage === "pack" || stage === "load") && <div className={s.preShootMetrics}><b>PACKED <span>{packed} / {items.length}</span></b><b>LOADED <span>{loaded} / {items.length}</span></b></div>}
    {stage === "pack" || stage === "load" ? <GearStage items={items} mode={stage} pending={pending} onToggle={toggleGear} /> : stage === "final" ? <section className={s.preShootChecks}><h2>Final check — before you leave</h2><p>Fast confirmation for the essentials.</p>{checks.map((c) => <button key={c.sort_order} className={`${s.finalCheck} ${c.checked ? s.finalCheckDone : ""}`} onClick={() => toggleFinal(c)}><span>{c.checked && <Check size={19} />}</span>{c.item}</button>)}</section> : <section className={s.preShootChecks}><PackageCheck size={30} /><h2>Almost there</h2><p>Complete every required gear check and the final check to unlock ready.</p></section>}
    <div className={s.preShootBottom}>{stage === "pack" && <button className={s.button} onClick={() => setStage("load")}>Continue to load</button>}{stage === "load" && <button className={s.button} onClick={() => setStage("final")}>Continue to final check</button>}{stage === "final" && <button className={s.button} onClick={() => setStage("ready")}>Review readiness</button>}{pending && <LoaderCircle className={s.spin} size={17} />}</div>
  </div>;
}
function GearStage({ items, mode, pending, onToggle }: { items: ShootItem[]; mode: string; pending: boolean; onToggle: (id: string, field: "packed" | "loaded", value: boolean) => void }) {
  const groups = new Map<string, ShootItem[]>(); items.forEach((item) => groups.set(item.category, [...(groups.get(item.category) ?? []), item]));
  return <section className={s.gearGroups}>{items.length === 0 ? <div className={s.empty}><strong>No gear selected yet</strong><Link className={s.button} href="/admin/pre-shoot">Add gear from the shoot list</Link></div> : [...groups].map(([category, rows]) => <details className={s.gearGroup} open key={category}><summary>{category}<span>{rows.filter((x) => mode === "pack" ? x.packed : x.loaded).length}/{rows.length}<ChevronDown size={16} /></span></summary>{rows.map((item) => { const checked = mode === "pack" ? item.packed : item.loaded; return <button key={item.id} disabled={pending} className={`${s.gearCheck} ${checked ? s.gearCheckDone : ""} ${item.shoot_required ? s.gearCheckRequired : ""}`} onClick={() => onToggle(item.id, mode === "pack" ? "packed" : "loaded", !checked)}><span>{checked && <Check size={20} />}</span><b>{item.name}</b>{item.shoot_required && <small>Required</small>}<em>{mode === "pack" ? "Packed" : "Loaded"}</em></button>; })}</details>)}</section>;
}
