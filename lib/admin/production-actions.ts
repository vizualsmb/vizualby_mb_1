"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { ActionState } from "./actions";
import { requireAdmin } from "./auth";
import { seedProjectStages, STAGES, TIME_CATEGORIES, PROJECT_LANES } from "./production";

const uuid = z.uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const form = (fd: FormData) => Object.fromEntries(fd.entries());
const fail = (error: string): ActionState => ({ error });
const optional = <T extends z.ZodType>(schema: T) => z.preprocess((value) => value === "" || value === null ? undefined : value, schema.optional());
const toDate = (value?: string) => value ? new Date(`${value}T12:00:00-04:00`).toISOString() : null;

async function audit(action: string, entity: string, entityId: string, data?: unknown) {
  const { supabase, userId } = await requireAdmin();
  await supabase.from("audit_logs").insert({ actor_id: userId, action, entity, entity_id: entityId, data: data ?? null });
}
function refresh(projectId?: string) { revalidatePath("/admin", "layout"); if (projectId) revalidatePath(`/admin/projects/${projectId}`); }

export async function createCustomProject(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ client_id: uuid, title: z.string().trim().min(1).max(160), project_type: z.string().trim().min(1).max(100), price: z.string().trim().max(20), shoot_day: optional(day), delivery_day: optional(day), revisions_included: z.coerce.number().int().min(0).max(20), notes: z.string().trim().max(5000) }).safeParse(form(fd));
  if (!input.success) return fail("Choose a client and complete the project details.");
  const price = input.data.price ? Number.parseFloat(input.data.price) : null;
  if (price !== null && (!Number.isFinite(price) || price < 0 || price > 1000000)) return fail("Enter a valid project price.");
  const { data, error } = await supabase.from("projects").insert({ client_id: input.data.client_id, title: input.data.title, project_type: input.data.project_type, quoted_price_cents: price === null ? null : Math.round(price * 100), shoot_at: toDate(input.data.shoot_day), delivery_at: toDate(input.data.delivery_day), revisions_included: input.data.revisions_included, notes: input.data.notes || null }).select("id").single();
  if (error) return fail("Could not create the project.");
  try { await seedProjectStages(supabase, data.id); } catch { await supabase.from("projects").delete().eq("id", data.id); return fail("Could not create the project workflow."); }
  await audit("create", "project", data.id, { custom: true }); refresh(data.id);
  return { ok: true, message: "Custom project created." };
}

export async function createProjectFromBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ booking_id: uuid }).safeParse(form(fd));
  if (!input.success) return fail("Booking not found.");
  const { data, error } = await supabase.from("projects").insert({ booking_id: input.data.booking_id }).select("id").single();
  if (error) return fail("This booking already has a production project, or it could not be linked.");
  try { await seedProjectStages(supabase, data.id); } catch { await supabase.from("projects").delete().eq("id", data.id); return fail("Could not create the project workflow."); }
  await audit("create", "project", data.id, { booking_id: input.data.booking_id }); refresh(data.id);
  return { ok: true, message: "Production project created." };
}

export async function addProjectTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ project_id: uuid, stage: z.enum(STAGES), title: z.string().trim().min(1).max(240) }).safeParse(form(fd));
  if (!input.success) return fail("Enter a task and stage.");
  const { error } = await supabase.from("project_tasks").insert({ ...input.data, sort_order: Date.now() });
  if (error) return fail("Could not add the task."); refresh(input.data.project_id); return { ok: true, message: "Task added." };
}

export async function toggleProjectFocus(projectId: string, focused: boolean): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(projectId).success) return fail("Project not found.");
  if (focused) {
    const { error: clearError } = await supabase.from("projects").update({ is_focus: false }).eq("is_focus", true);
    if (clearError) return fail("Could not update focus.");
  }
  const { error } = await supabase.from("projects").update({ is_focus: focused }).eq("id", projectId);
  if (error) return fail("Could not update focus.");
  await audit(focused ? "focus" : "unfocus", "project", projectId);
  revalidatePath("/admin", "layout");
  return { ok: true, message: focused ? "Project is now the focus." : "Project removed from focus." };
}

export async function setProjectLane(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ project_id: uuid, lane: z.enum(PROJECT_LANES) }).safeParse(form(fd));
  if (!input.success) return fail("Choose a valid project lane.");
  const { error } = await supabase.from("projects").update({ workflow_lane: input.data.lane }).eq("id", input.data.project_id);
  if (error) return fail("Could not update the project lane.");
  await audit("lane", "project", input.data.project_id, { lane: input.data.lane });
  refresh(input.data.project_id); revalidatePath("/admin/projects");
  return { ok: true, message: "Project lane updated." };
}

export async function toggleProjectTask(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ id: uuid, project_id: uuid, completed: z.enum(["true", "false"]) }).safeParse(form(fd));
  if (!input.success) return fail("Task not found.");
  const completed = input.data.completed === "true";
  const { error } = await supabase.from("project_tasks").update({ completed, completed_at: completed ? new Date().toISOString() : null }).eq("id", input.data.id).eq("project_id", input.data.project_id);
  if (error) return fail("Could not update the task."); refresh(input.data.project_id); return { ok: true, message: "Task updated." };
}

type TimerResult = { ok: boolean; error?: string };
export async function startProjectTimer(projectId: string, category: string): Promise<TimerResult> {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(projectId).success || !TIME_CATEGORIES.includes(category as typeof TIME_CATEGORIES[number])) return { ok: false, error: "Invalid timer." };
  const now = new Date().toISOString();
  const { error } = await supabase.from("project_time_sessions").insert({ project_id: projectId, category, started_at: now, active_started_at: now });
  if (error) return { ok: false, error: "A timer is already active for this project." };
  refresh(projectId); return { ok: true };
}

async function activeTimer(sessionId: string) {
  const { supabase } = await requireAdmin();
  if (!uuid.safeParse(sessionId).success) return { error: "Timer not found." as string };
  const { data, error } = await supabase.from("project_time_sessions").select("id, project_id, active_started_at, duration_seconds, ended_at").eq("id", sessionId).maybeSingle();
  if (error || !data || data.ended_at) return { error: "Timer is no longer active." as string };
  return { supabase, session: data as { id: string; project_id: string; active_started_at: string | null; duration_seconds: number; ended_at: string | null } };
}
export async function pauseProjectTimer(sessionId: string): Promise<TimerResult> {
  const row = await activeTimer(sessionId); if ("error" in row) return { ok: false, error: row.error };
  if (!row.session.active_started_at) return { ok: false, error: "Timer is already paused." };
  const now = new Date(); const elapsed = Math.max(0, Math.floor((now.getTime() - Date.parse(row.session.active_started_at)) / 1000));
  const { error } = await row.supabase.from("project_time_sessions").update({ duration_seconds: row.session.duration_seconds + elapsed, active_started_at: null, paused_at: now.toISOString() }).eq("id", row.session.id);
  if (error) return { ok: false, error: "Could not pause the timer." }; refresh(row.session.project_id); return { ok: true };
}
export async function resumeProjectTimer(sessionId: string): Promise<TimerResult> {
  const row = await activeTimer(sessionId); if ("error" in row) return { ok: false, error: row.error };
  if (row.session.active_started_at) return { ok: false, error: "Timer is already running." };
  const now = new Date().toISOString(); const { error } = await row.supabase.from("project_time_sessions").update({ active_started_at: now, resumed_at: now }).eq("id", row.session.id);
  if (error) return { ok: false, error: "Could not resume the timer." }; refresh(row.session.project_id); return { ok: true };
}
export async function stopProjectTimer(sessionId: string): Promise<TimerResult> {
  const row = await activeTimer(sessionId); if ("error" in row) return { ok: false, error: row.error };
  const now = new Date(); const elapsed = row.session.active_started_at ? Math.max(0, Math.floor((now.getTime() - Date.parse(row.session.active_started_at)) / 1000)) : 0;
  const { error } = await row.supabase.from("project_time_sessions").update({ duration_seconds: row.session.duration_seconds + elapsed, active_started_at: null, ended_at: now.toISOString() }).eq("id", row.session.id);
  if (error) return { ok: false, error: "Could not stop the timer." }; await audit("stop", "project_time_session", row.session.id); refresh(row.session.project_id); return { ok: true };
}

export async function addManualProjectTime(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ project_id: uuid, work_day: day, duration_minutes: z.coerce.number().int().min(1).max(24 * 60), category: z.enum(TIME_CATEGORIES), notes: z.string().trim().max(1000) }).safeParse(form(fd));
  if (!input.success) return fail("Enter a valid date, duration, and category.");
  const started = new Date(`${input.data.work_day}T12:00:00-04:00`).toISOString();
  const { error } = await supabase.from("project_time_sessions").insert({ project_id: input.data.project_id, category: input.data.category, started_at: started, ended_at: started, duration_seconds: input.data.duration_minutes * 60, notes: input.data.notes || null });
  if (error) return fail("Could not save manual time."); refresh(input.data.project_id); return { ok: true, message: "Manual time saved." };
}
