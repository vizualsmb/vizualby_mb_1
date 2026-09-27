import Link from "next/link";
import { ArrowRight, Palette, Pencil, Scissors, Sparkles, Volume2 } from "lucide-react";
import { STAGES, stageLabel, stageTone } from "@/lib/admin/production";
import { FocusToggle } from "@/components/admin/FocusToggle";
import s from "./admin.module.css";

type ProjectList = Awaited<ReturnType<typeof import("@/lib/admin/production").projectList>>;
const STAGE_ICONS = { footage: Scissors, editing: Pencil, color: Palette, vfx: Sparkles, sound: Volume2 } as const;

export function ProductionWorkflow({ projectRows }: { projectRows: ProjectList }) {
  const ordered = [...projectRows].sort((a, b) => (a.project.delivery_at ? Date.parse(a.project.delivery_at) : Number.MAX_SAFE_INTEGER) - (b.project.delivery_at ? Date.parse(b.project.delivery_at) : Number.MAX_SAFE_INTEGER));
  return <section className={`${s.productionCard} ${s.productionWorkflow}`}><div className={s.productionSectionHead}><h2>Post-Production Workflow</h2><Link href="/admin/projects">Projects <ArrowRight size={15} /></Link></div><div className={s.productionStages}>{STAGES.map((stage) => { const Icon = STAGE_ICONS[stage]; const rows = ordered.filter((row) => row.project.current_stage === stage); return <div className={s.productionStageColumn} key={stage}><div className={`${s.productionStageTitle} ${s[stageTone(stage)]}`}><span><i><Icon size={15} aria-hidden /></i><b>{stageLabel(stage)}</b></span><small>{rows.length}</small></div><div className={s.productionStageProjects}>{rows.length ? rows.map((row) => { const title = row.project.title ?? row.booking?.project_title ?? row.booking?.package_name ?? "Untitled project"; return <div className={`${s.productionStageProject} ${s[stageTone(stage)]}`} key={row.project.id}><Link href={`/admin/projects/${row.project.id}`}><strong>{title}</strong><small>{row.project.delivery_at ? `Due ${new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(new Date(row.project.delivery_at))}` : "No delivery date"} · {row.progress}%</small></Link><FocusToggle projectId={row.project.id} focused={row.project.is_focus} /></div>; }) : <span className={s.productionStageEmpty}>No projects</span>}</div></div>; })}</div></section>;
}
