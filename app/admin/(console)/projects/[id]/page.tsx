import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/admin/ActionForm";
import { Card, PageHeader } from "@/components/admin/ui";
import { ProjectTimer } from "@/components/admin/ProjectTimer";
import { TaskToggle } from "@/components/admin/TaskToggle";
import { requireAdmin } from "@/lib/admin/auth";
import { productionProjectDetail, elapsedSeconds, stageLabel, stageTone, STAGES } from "@/lib/admin/production";
import { addManualProjectTime, addProjectTask } from "@/lib/admin/production-actions";
import s from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Project" };
const label = stageLabel;
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "—";
const duration = (seconds: number) => `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;

export default async function ProjectDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const { supabase } = await requireAdmin(); const detail = await productionProjectDetail(supabase, id); if (!detail) notFound();
  const { project, booking, client, stages, tasks, sessions } = detail;
  const title = project.title ?? booking?.project_title ?? booking?.package_name ?? "Untitled project";
  const clientName = client?.name ?? booking?.client_name ?? "Unknown client";
  const active = sessions.find((session) => !session.ended_at) ?? null;
  const total = sessions.reduce((sum, session) => sum + elapsedSeconds(session), 0);
  const completed = tasks.filter((task) => task.completed).length;
  const progress = tasks.length ? Math.round((completed / tasks.length) * 100) : 0;
  return <div className={s.projectWorkspace}>
    <Link className={s.projectBackLink} href="/admin/projects"><ArrowLeft size={14} />All projects</Link>
    <div className={s.projectHero}>
      <PageHeader eyebrow={`Client · ${clientName}`} title={title} subtitle={project.project_type ?? booking?.package_name ?? "Custom project"}>
        <span className={`${s.productionBadge} ${s[stageTone(project.current_stage)]}`}>In {label(project.current_stage)}</span>
      </PageHeader>
      <div className={s.projectFacts}><span><small>Shoot date</small><b>{date(project.shoot_at ?? booking?.shoot_start ?? null)}</b></span><span><small>Delivery</small><b>{date(project.delivery_at)}</b></span><span><small>Revision</small><b>0 of {project.revisions_included}</b></span><span><small>Tracked time</small><b>{duration(total)}</b></span></div>
    </div>
    <section className={s.projectWorkflow} aria-label="Post-production workflow"><div className={s.projectWorkflowHead}><span>Post-production workflow</span><span>{progress}% complete</span></div><div className={s.projectStageRail}>{STAGES.map((stage, index) => { const row = stages.find((item) => item.stage === stage); return <span className={`${stage === project.current_stage ? s.projectStageCurrent : row?.status === "completed" ? s.projectStageDone : ""} ${s[stageTone(stage)]}`} key={stage}><i>{index + 1}</i><b>{label(stage)}</b></span>; })}</div></section>
    <div className={s.projectDetailGrid}><div className={s.stack}><Card title="Production checklist" action={<span className={s.metaText}>{completed} of {tasks.length} complete</span>}><div className={s.progress}><span style={{ width: `${progress}%` }} /></div><div className={s.projectTaskList}>{tasks.length ? tasks.map((task) => <TaskToggle key={task.id} id={task.id} projectId={project.id} title={task.title} completed={task.completed} stage={label(task.stage)} />) : <p className={s.hint}>Add the first task below.</p>}</div><details className={s.disclosure} style={{ marginTop: 16 }}><summary className={`${s.button} ${s.buttonGhost}`}>Add task</summary><ActionForm action={addProjectTask} submit="Add task" resetOnSuccess><input type="hidden" name="project_id" value={project.id} /><div className={s.formGrid}><label className={s.field}>Task<input className={s.input} name="title" required maxLength={240} /></label><label className={s.field}>Stage<select className={s.input} name="stage" defaultValue={project.current_stage}>{STAGES.map((stage) => <option value={stage} key={stage}>{label(stage)}</option>)}</select></label></div></ActionForm></details></Card>
      <Card title="Time sessions" action={<span className={s.metaText}>{duration(total)} total</span>}><div className={s.projectSessionList}>{sessions.filter((session) => session.ended_at).map((session) => <div key={session.id}><span><b>{label(session.category)}</b><small>{date(session.started_at)}</small></span><span>{duration(session.duration_seconds)}</span></div>)}{!sessions.some((session) => session.ended_at) && <p className={s.hint}>Completed sessions will appear here.</p>}</div><details className={s.disclosure} style={{ marginTop: 16 }}><summary className={`${s.button} ${s.buttonGhost}`}>Add manual time</summary><ActionForm action={addManualProjectTime} submit="Save time" resetOnSuccess><input type="hidden" name="project_id" value={project.id} /><div className={s.formGrid}><label className={s.field}>Date<input className={s.input} type="date" name="work_day" required /></label><label className={s.field}>Duration (minutes)<input className={s.input} type="number" name="duration_minutes" min="1" max="1440" required /></label><label className={s.field}>Work type<select className={s.input} name="category"><option value="editing">Editing</option><option value="vfx">VFX</option><option value="color">Color</option><option value="sound">Sound</option><option value="revisions">Revisions</option><option value="other">Other</option></select></label><label className={`${s.field} ${s.fieldWide}`}>Note<input className={s.input} name="notes" maxLength={1000} /></label></div></ActionForm></details></Card></div>
      <div className={s.stack}><ProjectTimer projectId={project.id} session={active} /><Card title="Project notes">{project.notes ? <p className={s.prose}>{project.notes}</p> : <p className={s.hint}>No notes yet.</p>}</Card><Card title="Booking connection">{booking ? <p className={s.secondaryText}>This project uses the existing booking for client, shoot, and finance information. <Link className={s.rowLink} href={`/admin/bookings/${booking.id}`}>Open booking →</Link></p> : <p className={s.secondaryText}>This is an independent custom project; it does not create a booking.</p>}</Card></div></div>
  </div>;
}
