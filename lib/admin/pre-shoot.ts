import "server-only";
import type { AdminSupabaseClient } from "@/lib/supabase/service";

export const EQUIPMENT_CATEGORIES = ["Cameras", "Lenses", "Stabilization", "Lighting", "Audio", "Power", "Media", "Drone / Action Cameras", "Grip / Accessories", "Personal / Production Essentials"] as const;
export type Equipment = { id: string; name: string; category: string; quantity: number; notes: string | null; required: boolean; active: boolean; archived_at: string | null };
export type Shoot = { id: string; project_id: string | null; client_id: string | null; name: string; shoot_type: string | null; shoot_at: string; location: string | null; shot_list_url: string | null; status: string; stage: string };
export type ShootItem = Equipment & { packed: boolean; loaded: boolean; shoot_required: boolean; selected_quantity: number };

const unavailable = (e: { code?: string; message?: string } | null) => Boolean(e && (e.code === "42P01" || e.message?.includes("does not exist") || e.message?.includes("schema cache")));
export async function preShootData(db: AdminSupabaseClient) {
  const [{ data: equipment, error: ee }, { data: kits, error: ke }, { data: shoots, error: se }, { data: projects, error: pe }, { data: clients, error: ce }] = await Promise.all([
    db.from("equipment").select("*").is("archived_at", null).order("category").order("name"), db.from("equipment_kits").select("*").order("name"),
    db.from("shoots").select("*").order("shoot_at").limit(100), db.from("projects").select("id, title, project_type").order("created_at", { ascending: false }).limit(100), db.from("clients").select("id, name").order("name").limit(200),
  ]);
  if ([ee, ke, se, pe, ce].some(unavailable)) return null;
  if (ee || ke || se || pe || ce) throw new Error(ee?.message ?? ke?.message ?? se?.message ?? pe?.message ?? ce?.message ?? "Could not load pre-shoot data.");
  return { equipment: (equipment ?? []) as Equipment[], kits: (kits ?? []) as { id: string; name: string }[], shoots: (shoots ?? []) as Shoot[], projects: (projects ?? []) as { id: string; title: string | null; project_type: string | null }[], clients: (clients ?? []) as { id: string; name: string }[] };
}
export async function shootDetail(db: AdminSupabaseClient, shootId: string) {
  const [{ data: shoot, error: shootError }, { data: equipment, error: itemError }, { data: finalChecks, error: finalError }] = await Promise.all([
    db.from("shoots").select("*").eq("id", shootId).maybeSingle(),
    db.from("shoot_equipment").select("packed, loaded, required, quantity, equipment(*)").eq("shoot_id", shootId),
    db.from("shoot_final_checks").select("item, checked, sort_order").eq("shoot_id", shootId).order("sort_order"),
  ]);
  if ([shootError, itemError, finalError].some(unavailable)) return null;
  if (shootError || itemError || finalError || !shoot) throw new Error(shootError?.message ?? itemError?.message ?? finalError?.message ?? "Shoot not found.");
  type EquipmentJoin = { packed: boolean; loaded: boolean; required: boolean; quantity: number; equipment: Equipment | null };
  const items = ((equipment ?? []) as unknown as EquipmentJoin[]).flatMap((row) => row.equipment ? [{ ...row.equipment, packed: row.packed, loaded: row.loaded, shoot_required: row.required, selected_quantity: row.quantity }] : []) as ShootItem[];
  return { shoot: shoot as Shoot, items, finalChecks: (finalChecks ?? []) as { item: string; checked: boolean; sort_order: number }[] };
}
