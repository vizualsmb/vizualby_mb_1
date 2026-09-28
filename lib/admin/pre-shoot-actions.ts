"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "./auth";

const uuid = z.uuid();
const dateTime = z.string().min(16).max(40);
const refresh = (shootId?: string) => { revalidatePath("/admin"); revalidatePath("/admin/pre-shoot"); revalidatePath("/admin/equipment"); if (shootId) revalidatePath(`/admin/pre-shoot/${shootId}`); };
const text = (v: FormDataEntryValue | null) => typeof v === "string" ? v.trim() : "";

export async function createEquipment(fd: FormData) {
  const { supabase, userId } = await requireAdmin();
  const input = z.object({ name: z.string().min(1).max(120), category: z.string().min(1).max(80), quantity: z.coerce.number().int().min(1).max(99), notes: z.string().max(1000), required: z.boolean() }).safeParse({ name: text(fd.get("name")), category: text(fd.get("category")), quantity: text(fd.get("quantity")) || "1", notes: text(fd.get("notes")), required: fd.get("required") === "on" });
  if (!input.success) return { ok: false, error: "Enter an equipment name and category." };
  const { error } = await supabase.from("equipment").insert({ ...input.data, notes: input.data.notes || null });
  if (error) return { ok: false, error: "Could not save equipment." };
  await supabase.from("audit_logs").insert({ actor_id: userId, action: "create", entity: "equipment", entity_id: "inventory", data: { name: input.data.name } }); refresh(); return { ok: true };
}
export async function archiveEquipment(id: string, active: boolean) {
  const { supabase } = await requireAdmin(); if (!uuid.safeParse(id).success) return { ok: false };
  const { error } = await supabase.from("equipment").update(active ? { active: false } : { archived_at: new Date().toISOString(), active: false }).eq("id", id);
  refresh(); return { ok: !error };
}
export async function createKit(fd: FormData) {
  const { supabase } = await requireAdmin(); const name = text(fd.get("name")); if (!name || name.length > 100) return { ok: false, error: "Enter a kit name." };
  const equipmentIds = fd.getAll("equipment_id").filter((v): v is string => typeof v === "string" && uuid.safeParse(v).success);
  const { data: kit, error } = await supabase.from("equipment_kits").insert({ name }).select("id").single();
  if (error || !kit) return { ok: false, error: "Could not create kit." };
  if (equipmentIds.length) await supabase.from("equipment_kit_items").insert(equipmentIds.map((equipment_id) => ({ kit_id: kit.id, equipment_id })));
  refresh(); return { ok: true };
}
export async function createShoot(fd: FormData) {
  const { supabase } = await requireAdmin();
  const input = z.object({ name: z.string().min(1).max(160), shoot_at: dateTime, location: z.string().max(300), shoot_type: z.string().max(100), project_id: z.string(), client_id: z.string(), shot_list_url: z.string() }).safeParse({ name: text(fd.get("name")), shoot_at: text(fd.get("shoot_at")), location: text(fd.get("location")), shoot_type: text(fd.get("shoot_type")), project_id: text(fd.get("project_id")), client_id: text(fd.get("client_id")), shot_list_url: text(fd.get("shot_list_url")) });
  if (!input.success || Number.isNaN(Date.parse(input.data?.shoot_at ?? ""))) return { ok: false, error: "Enter a name and valid shoot date." };
  const validUrl = !input.data.shot_list_url || /^https?:\/\//.test(input.data.shot_list_url); if (!validUrl) return { ok: false, error: "Shot list link must start with https://" };
  const { data, error } = await supabase.from("shoots").insert({ ...input.data, project_id: uuid.safeParse(input.data.project_id).success ? input.data.project_id : null, client_id: uuid.safeParse(input.data.client_id).success ? input.data.client_id : null, location: input.data.location || null, shoot_type: input.data.shoot_type || null, shot_list_url: input.data.shot_list_url || null, shoot_at: new Date(input.data.shoot_at).toISOString() }).select("id").single();
  if (error || !data) return { ok: false, error: "Could not create quick shoot." }; refresh(data.id); return { ok: true, id: data.id };
}
export async function addShootEquipment(shootId: string, equipmentId: string) {
  const { supabase } = await requireAdmin(); if (!uuid.safeParse(shootId).success || !uuid.safeParse(equipmentId).success) return { ok: false };
  const { data: gear } = await supabase.from("equipment").select("required").eq("id", equipmentId).maybeSingle();
  const { error } = await supabase.from("shoot_equipment").upsert({ shoot_id: shootId, equipment_id: equipmentId, required: gear?.required === true }, { onConflict: "shoot_id,equipment_id", ignoreDuplicates: true }); refresh(shootId); return { ok: !error };
}
export async function loadKit(shootId: string, kitId: string) {
  const { supabase } = await requireAdmin(); if (!uuid.safeParse(shootId).success || !uuid.safeParse(kitId).success) return { ok: false };
  const { data, error } = await supabase.from("equipment_kit_items").select("equipment_id, quantity, equipment(required)").eq("kit_id", kitId); if (error) return { ok: false };
  const rows = ((data ?? []) as unknown as { equipment_id: string; quantity: number; equipment: { required: boolean } | null }[]).map((row) => ({ shoot_id: shootId, equipment_id: row.equipment_id, quantity: row.quantity, required: row.equipment?.required === true }));
  if (rows.length) await supabase.from("shoot_equipment").upsert(rows, { onConflict: "shoot_id,equipment_id", ignoreDuplicates: true }); refresh(shootId); return { ok: true };
}
export async function setShootItem(shootId: string, equipmentId: string, field: "packed" | "loaded", value: boolean) {
  const { supabase } = await requireAdmin(); if (!uuid.safeParse(shootId).success || !uuid.safeParse(equipmentId).success || (field === "loaded" && value)) {
    if (field !== "loaded" || !value) return { ok: false };
  }
  const patch = field === "loaded" && value ? { loaded: true, packed: true } : { [field]: value, ...(field === "packed" && !value ? { loaded: false } : {}) };
  const { error } = await supabase.from("shoot_equipment").update(patch).eq("shoot_id", shootId).eq("equipment_id", equipmentId); await updateShootStatus(supabase, shootId); refresh(shootId); return { ok: !error };
}
export async function setFinalCheck(shootId: string, sortOrder: number, checked: boolean) {
  const { supabase } = await requireAdmin(); if (!uuid.safeParse(shootId).success || !Number.isInteger(sortOrder) || sortOrder < 0 || sortOrder > 99) return { ok: false };
  const { error } = await supabase.from("shoot_final_checks").update({ checked }).eq("shoot_id", shootId).eq("sort_order", sortOrder); await updateShootStatus(supabase, shootId); refresh(shootId); return { ok: !error };
}
export async function initializeFinalChecks(shootId: string) {
  const { supabase } = await requireAdmin(); if (!uuid.safeParse(shootId).success) return { ok: false };
  const { data: shoot } = await supabase.from("shoots").select("final_checks").eq("id", shootId).maybeSingle();
  const checks = Array.isArray(shoot?.final_checks) ? shoot.final_checks.filter((v): v is string => typeof v === "string") : [];
  if (checks.length) await supabase.from("shoot_final_checks").upsert(checks.map((item, sort_order) => ({ shoot_id: shootId, item, sort_order })), { onConflict: "shoot_id,sort_order", ignoreDuplicates: true }); refresh(shootId); return { ok: true };
}
async function updateShootStatus(supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"], shootId: string) {
  const [{ data: gear }, { data: checks }] = await Promise.all([supabase.from("shoot_equipment").select("packed, loaded, required").eq("shoot_id", shootId), supabase.from("shoot_final_checks").select("checked").eq("shoot_id", shootId)]);
  const rows = gear ?? []; const allPacked = rows.length > 0 && rows.every((x) => x.packed); const allLoaded = rows.length > 0 && rows.every((x) => x.loaded); const requiredReady = rows.filter((x) => x.required).every((x) => x.packed && x.loaded); const finalReady = (checks ?? []).length > 0 && (checks ?? []).every((x) => x.checked);
  const status = allLoaded && requiredReady && finalReady ? "ready" : allLoaded ? "loaded" : allPacked ? "packed" : rows.some((x) => x.packed) ? "packing" : "not_started";
  const stage = status === "ready" ? "ready" : allLoaded ? "final" : allPacked ? "load" : "pack"; await supabase.from("shoots").update({ status, stage }).eq("id", shootId);
}
