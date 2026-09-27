import "server-only";
import type { AdminSupabaseClient } from "@/lib/supabase/service";

// Keep the database values stable for existing projects, but present the
// production workflow as the five steps MB actually uses.
export const STAGES = ["footage", "editing", "color", "vfx", "sound"] as const;
export const TIME_CATEGORIES = ["editing", "vfx", "color", "sound", "revisions", "other"] as const;
export type ProductionStage = typeof STAGES[number];
export const PROJECT_LANES = ["active", "review", "delivered"] as const;
export type ProjectLane = typeof PROJECT_LANES[number];
export type TimeCategory = typeof TIME_CATEGORIES[number];

export type Project = {
  id: string; booking_id: string | null; client_id: string | null; title: string | null; project_type: string | null;
  quoted_price_cents: number | null; shoot_at: string | null; delivery_at: string | null; revisions_included: number;
  notes: string | null; current_stage: ProductionStage; workflow_lane: ProjectLane; is_focus: boolean; created_at: string; updated_at: string;
};
export type ProjectStage = { id: string; project_id: string; stage: ProductionStage; status: string; due_at: string | null; completed_at: string | null; sort_order: number };
export type ProjectTask = { id: string; project_id: string; stage: ProductionStage; title: string; completed: boolean; completed_at: string | null; due_at: string | null; sort_order: number; notes: string | null };
export type TimeSession = { id: string; project_id: string; category: TimeCategory; started_at: string; active_started_at: string | null; paused_at: string | null; resumed_at: string | null; ended_at: string | null; duration_seconds: number; notes: string | null };

const requiredStages = STAGES.map((stage, index) => ({ stage, sort_order: index + 1 }));
const starterTasks: { stage: ProductionStage; title: string }[] = [
  { stage: "footage", title: "Cut" }, { stage: "editing", title: "Edit" }, { stage: "color", title: "Color Grade" }, { stage: "vfx", title: "VFX" }, { stage: "sound", title: "SFX" },
];
export const stageLabel = (value: string) => (({ footage: "Cut", editing: "Edit", color: "Color Grade", vfx: "VFX", sound: "SFX" } as Record<string, string>)[value] ?? value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()));
export const stageTone = (value: string) => ({ footage: "stageCut", editing: "stageEdit", color: "stageColor", vfx: "stageVfx", sound: "stageSound" } as Record<string, string>)[value] ?? "stageEdit";
const schemaUnavailable = (error: { code?: string; message?: string } | null) => {
  const message = error?.message?.toLowerCase() ?? "";
  return Boolean(error && (error.code === "42P01" || message.includes("does not exist") || message.includes("schema cache") || message.includes("could not find the table")));
};

export async function projectList(db: AdminSupabaseClient) {
  const { data, error } = await db.from("projects").select("*").order("delivery_at", { ascending: true, nullsFirst: false }).limit(200);
  if (schemaUnavailable(error)) return [];
  if (error) throw new Error(error.message);
  const projects = (data ?? []) as Project[];
  const clientIds = [...new Set(projects.map((p) => p.client_id).filter(Boolean))] as string[];
  const bookingIds = [...new Set(projects.map((p) => p.booking_id).filter(Boolean))] as string[];
  const projectIds = projects.map((p) => p.id);
  const [clients, bookings, tasks, sessions] = await Promise.all([
    clientIds.length ? db.from("clients").select("id, name").in("id", clientIds) : Promise.resolve({ data: [] as { id: string; name: string }[], error: null }),
    bookingIds.length ? db.from("booking_ledger").select("id, client_name, project_title, package_name, shoot_start, total_cents").in("id", bookingIds) : Promise.resolve({ data: [] as { id: string; client_name: string; project_title: string | null; package_name: string | null; shoot_start: string | null; total_cents: number }[], error: null }),
    projectIds.length ? db.from("project_tasks").select("project_id, completed").in("project_id", projectIds) : Promise.resolve({ data: [] as { project_id: string; completed: boolean }[], error: null }),
    projectIds.length ? db.from("project_time_sessions").select("project_id, duration_seconds, active_started_at").in("project_id", projectIds) : Promise.resolve({ data: [] as Pick<TimeSession, "project_id" | "duration_seconds" | "active_started_at">[], error: null }),
  ]);
  if (clients.error || bookings.error || tasks.error || sessions.error) throw new Error(clients.error?.message ?? bookings.error?.message ?? tasks.error?.message ?? sessions.error?.message ?? "Could not load projects.");
  const names = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const bookingById = new Map((bookings.data ?? []).map((b) => [b.id, b]));
  return projects.map((project) => {
    const projectTasks = (tasks.data ?? []).filter((task) => task.project_id === project.id);
    const projectSessions = (sessions.data ?? []).filter((session) => session.project_id === project.id) as TimeSession[];
    return { project, clientName: project.client_id ? names.get(project.client_id) ?? "Unknown client" : null, booking: project.booking_id ? bookingById.get(project.booking_id) ?? null : null, progress: projectTasks.length ? Math.round(projectTasks.filter((task) => task.completed).length / projectTasks.length * 100) : 0, totalSeconds: projectSessions.reduce((sum, session) => sum + elapsedSeconds(session), 0) };
  });
}

export async function productionProjectDetail(db: AdminSupabaseClient, id: string) {
  const [{ data: project, error: projectError }, { data: stages, error: stagesError }, { data: tasks, error: tasksError }, { data: sessions, error: sessionsError }] = await Promise.all([
    db.from("projects").select("*").eq("id", id).maybeSingle(),
    db.from("project_stages").select("*").eq("project_id", id).order("sort_order"),
    db.from("project_tasks").select("*").eq("project_id", id).order("sort_order"),
    db.from("project_time_sessions").select("*").eq("project_id", id).order("started_at", { ascending: false }).limit(100),
  ]);
  if ([projectError, stagesError, tasksError, sessionsError].some(schemaUnavailable)) return null;
  if (projectError || stagesError || tasksError || sessionsError) throw new Error(projectError?.message ?? stagesError?.message ?? tasksError?.message ?? sessionsError?.message ?? "Could not load project.");
  if (!project) return null;
  const p = project as Project;
  const [{ data: client }, { data: booking }] = await Promise.all([
    p.client_id ? db.from("clients").select("id, name").eq("id", p.client_id).maybeSingle() : Promise.resolve({ data: null }),
    p.booking_id ? db.from("booking_ledger").select("id, client_name, project_title, package_name, shoot_start, total_cents").eq("id", p.booking_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return { project: p, client: client as { id: string; name: string } | null, booking: booking as { id: string; client_name: string; project_title: string | null; package_name: string | null; shoot_start: string | null; total_cents: number } | null, stages: (stages ?? []) as ProjectStage[], tasks: (tasks ?? []) as ProjectTask[], sessions: (sessions ?? []) as TimeSession[] };
}

export async function seedProjectStages(db: AdminSupabaseClient, projectId: string) {
  const [stages, tasks] = await Promise.all([
    db.from("project_stages").insert(requiredStages.map((row) => ({ ...row, project_id: projectId }))),
    db.from("project_tasks").insert(starterTasks.map((row, index) => ({ ...row, project_id: projectId, sort_order: index + 1 }))),
  ]);
  if (stages.error || tasks.error) throw new Error(stages.error?.message ?? tasks.error?.message ?? "Could not seed production workflow.");
}

export function elapsedSeconds(session: TimeSession, now = Date.now()) {
  const active = session.active_started_at ? Math.max(0, Math.floor((now - Date.parse(session.active_started_at)) / 1000)) : 0;
  return session.duration_seconds + active;
}
