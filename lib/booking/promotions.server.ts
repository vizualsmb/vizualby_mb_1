import "server-only";
import { createSupabaseService } from "@/lib/supabase/service";
import type { PublicPromotion } from "./promotions";
import { catalogPackages } from "./catalog.server";

type PromotionRow = {
  id: string; package_id: string; enabled: boolean; original_price_cents: number; discounted_price_cents: number;
  discount_type: "flat" | "percentage"; label: string | null; starts_on: string; ends_on: string;
  booking_deadline: string | null; limited_quantity: number | null; promo_code: string | null; value_note: string | null;
};

export type AdminPromotion = PromotionRow;

function newYorkDay(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function publicShape(row: PromotionRow, booked: number): PublicPromotion {
  return {
    id: row.id, packageId: row.package_id, originalPrice: row.original_price_cents,
    discountedPrice: row.discounted_price_cents, discountType: row.discount_type, label: row.label,
    startsOn: row.starts_on, endsOn: row.ends_on, bookingDeadline: row.booking_deadline,
    limitedQuantity: row.limited_quantity,
    remainingQuantity: row.limited_quantity === null ? null : Math.max(0, row.limited_quantity - booked),
    requiresCode: Boolean(row.promo_code), valueNote: row.value_note,
  };
}

async function bookedCounts(ids: string[]) {
  const db = createSupabaseService();
  const counts = new Map<string, number>();
  if (!db || !ids.length) return counts;
  const { data } = await db.from("bookings").select("promotion_id").in("promotion_id", ids).neq("status", "canceled");
  for (const row of data ?? []) if (row.promotion_id) counts.set(row.promotion_id, (counts.get(row.promotion_id) ?? 0) + 1);
  return counts;
}

export async function activePromotions(now = new Date()): Promise<PublicPromotion[]> {
  const db = createSupabaseService();
  if (!db) return [];
  const today = newYorkDay(now);
  const { data, error } = await db.from("promotions").select("*").eq("enabled", true).lte("starts_on", today).gte("ends_on", today);
  if (error) return [];
  const packages = new Map((await catalogPackages(db)).map((pkg) => [pkg.id, pkg.price]));
  const rows = ((data ?? []) as PromotionRow[]).filter((row) =>
    (!row.booking_deadline || row.booking_deadline >= today) && packages.get(row.package_id) === row.original_price_cents
  );
  const counts = await bookedCounts(rows.map((row) => row.id));
  return rows.map((row) => publicShape(row, counts.get(row.id) ?? 0)).filter((promo) => promo.remainingQuantity === null || promo.remainingQuantity > 0);
}

export async function resolvePromotion(packageId: string, promoCode?: string) {
  const db = createSupabaseService();
  const publicPromo = (await activePromotions()).find((promotion) => promotion.packageId === packageId);
  if (!db || !publicPromo) return null;
  const { data } = await db.from("promotions").select("promo_code").eq("id", publicPromo.id).maybeSingle();
  const required = data?.promo_code?.trim().toUpperCase() || "";
  if (required && required !== (promoCode || "").trim().toUpperCase()) throw new Error("PROMO_CODE_REQUIRED");
  return publicPromo;
}
