import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader, Empty } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/admin/auth";
import { listClients } from "@/lib/admin/queries";
import { projectList, stageLabel, stageTone } from "@/lib/admin/production";
import { createCustomProject } from "@/lib/admin/production-actions";
import { ProductionWorkflow } from "@/components/admin/ProductionWorkflow";
import { FocusToggle } from "@/components/admin/FocusToggle";
import s from "@/components/admin/admin.module.css";

export const metadata: Metadata = { title: "Projects" };
const date = (value: string | null) => value ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value)) : "No delivery date";

export default async function ProjectsPage() {
  const { supabase } = await requireAdmin();
  const [{ rows: clients }, projects] = await Promise.all([listClients(supabase, { page: 1 }), projectList(supabase)]);
  return <>
    <PageHeader eyebrow="Production workspace" title="Projects" subtitle="Booking projects stay linked to their intake and finance records. Custom projects live here independently."><a href="#new-project" className={s.button}><Plus size={16} />Custom project</a></PageHeader>
    <ProductionWorkflow projectRows={projects} />
    <div className={s.productionProjects}>
      {projects.length ? projects.map(({ project, clientName, booking }) => {
        const title = project.title ?? booking?.project_title ?? booking?.package_name ?? "Untitled project";
        const client = clientName ?? booking?.client_name ?? "Unknown client";
        return <div className={s.productionProjectRow} key={project.id}><Link className={s.productionProjectRowLink} href={`/admin/projects/${project.id}`}><span className={s.productionProjectIcon}>{title.slice(0, 1)}</span><span className={s.productionProjectInfo}><strong>{title}</strong><small>{client} · {project.project_type ?? booking?.package_name ?? "Custom project"}</small></span><span className={`${s.productionBadge} ${s[stageTone(project.current_stage)]}`}>{stageLabel(project.current_stage)}</span><span className={s.metaText}>{date(project.delivery_at)}</span></Link><FocusToggle projectId={project.id} focused={project.is_focus} /></div>;
      }) : <Empty title="No production projects yet">Create a custom project, or link a confirmed booking from its booking page.</Empty>}
    </div>
    <section className={`${s.card} ${s.section}`} id="new-project"><div className={s.cardHead}><h2 className={s.cardTitle}>New custom project</h2><span className={s.metaText}>Does not create a booking</span></div><ActionForm action={createCustomProject} submit="Create project" resetOnSuccess><div className={s.formGrid}><label className={s.field}>Client<select className={s.input} name="client_id" required defaultValue=""><option value="" disabled>Select client</option>{clients.map((client) => <option value={client.id} key={client.id}>{client.name}</option>)}</select></label><label className={s.field}>Project name<input className={s.input} name="title" required maxLength={160} /></label><label className={s.field}>Project type<input className={s.input} name="project_type" required maxLength={100} placeholder="Music video, commercial…" /></label><label className={s.field}>Price ($)<input className={s.input} name="price" inputMode="decimal" placeholder="Optional" /></label><label className={s.field}>Shoot date<input className={s.input} type="date" name="shoot_day" /></label><label className={s.field}>Delivery date<input className={s.input} type="date" name="delivery_day" /></label><label className={s.field}>Revisions included<input className={s.input} type="number" name="revisions_included" min="0" max="20" defaultValue="2" /></label><label className={`${s.field} ${s.fieldWide}`}>Notes<textarea className={s.input} name="notes" maxLength={5000} /></label></div></ActionForm></section>
  </>;
}
