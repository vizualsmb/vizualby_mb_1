import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import { projectList } from "@/lib/admin/production";
import { createCustomProject } from "@/lib/admin/production-actions";
import { ProductionWorkflow } from "@/components/admin/ProductionWorkflow";
import { ProjectLaneSelect } from "@/components/admin/ProjectLaneSelect";
import s from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const { supabase } = await requireAdmin();
  const [{ rows: clients }, projects] = await Promise.all([listClients(supabase, { page: 1 }), projectList(supabase)]);
  const timelineProjects = projects.filter(({ project }) => project.workflow_lane === "active");
  const parkedProjects = projects.filter(({ project }) => project.workflow_lane !== "active");
  return <>
    <PageHeader eyebrow="Production workspace" title="Projects" subtitle="Booking projects stay linked to their intake and finance records. Custom projects live here independently." />
    <ProductionWorkflow projectRows={timelineProjects} />
    {parkedProjects.length > 0 && <section className={`${s.productionCard} ${s.projectParking}`} aria-label="Projects off timeline"><div className={s.productionSectionHead}><div><h2>Off timeline</h2><p className={s.productionParkingHint}>Projects waiting on edits or already delivered.</p></div><span className={s.metaText}>{parkedProjects.length} parked</span></div><div className={s.projectParkingList}>{parkedProjects.map(({ project, clientName, booking, progress }) => { const title = project.title ?? booking?.project_title ?? booking?.package_name ?? "Untitled project"; return <article className={s.projectParkingRow} key={project.id}><span className={s.projectParkingMark}>{project.workflow_lane === "delivered" ? "✓" : "↺"}</span><div className={s.projectParkingInfo}><Link href={`/admin/projects/${project.id}`}><strong>{title}</strong></Link><small>{clientName ?? booking?.client_name ?? "Unknown client"} · {project.workflow_lane === "delivered" ? "Delivered" : `Edits / review · ${progress}%`}</small></div><ProjectLaneSelect projectId={project.id} lane={project.workflow_lane} /></article>; })}</div></section>}
    <section className={`${s.card} ${s.section}`} id="new-project"><div className={s.cardHead}><h2 className={s.cardTitle}>New custom project</h2><span className={s.metaText}>Does not create a booking</span></div><ActionForm action={createCustomProject} submit="Create project" resetOnSuccess><div className={s.formGrid}><label className={s.field}>Client<select className={s.input} name="client_id" required defaultValue=""><option value="" disabled>Select client</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label className={s.field}>Project name<input className={s.input} name="title" required maxLength={160} /></label><label className={s.field}>Project type<input className={s.input} name="project_type" required maxLength={100} placeholder="Music video, commercial…" /></label><label className={s.field}>Price ($)<input className={s.input} name="price" inputMode="decimal" placeholder="Optional" /></label><label className={s.field}>Shoot date<input className={s.input} type="date" name="shoot_day" /></label><label className={s.field}>Delivery date<input className={s.input} type="date" name="delivery_day" /></label><label className={s.field}>Revisions included<input className={s.input} type="number" name="revisions_included" min="0" max="20" defaultValue="2" /></label><label className={`${s.field} ${s.fieldWide}`}>Notes<textarea className={s.input} name="notes" maxLength={5000} /></label></div></ActionForm></section>
  </>;
}
