import "server-only";
import type { AdminSupabaseClient } from "@/lib/supabase/service";
import { isCommitted } from "./finance";
import { balanceReminder, shootReminder, type MessageBooking } from "./messages";
import { deliverOnce, studioSettings } from "./notify";
import { addDays, nyDay, startOfNyDay } from "./time";
import { catalogPackages } from "@/lib/booking/catalog.server";
import { calEvents } from "@/lib/booking/config";
import { syncCatalogPackage } from "@/lib/booking/cal-sync";

// The daily run (Vercel Cron → /api/admin/cron). Every step is idempotent, so
// running it twice in a day, or catching up after a missed day, is harmless.

const DAY_MS = 86400000;
const BEFORE_SHOOT = ["confirmed", "pre_production", "shoot_scheduled", "shoot_completed"];
const endOf = (b: { shoot_start: string; shoot_end: string | null }) => Date.parse(b.shoot_end ?? b.shoot_start);

async function setStatus(db: AdminSupabaseClient, ids: string[], status: string, extra: Record<string, unknown> = {}) {
  if (!ids.length) return 0;
  const { error } = await db.from("bookings").update({ status, ...extra }).in("id", ids);
  if (error) throw new Error(error.message);
  return ids.length;
}

export async function runStatusAutomation(db: AdminSupabaseClient, now: Date, archiveAfterDays: number | null) {
  const t = now.getTime();
  // Keep the board on the booked side during the shoot, then move directly to
  // Editing the following day. There is no extra manual "shoot completed" step.
  const { data: scheduled, error: e1 } = await db.from("bookings").select("id, shoot_start, shoot_end").in("status", BEFORE_SHOOT).not("shoot_start", "is", null);
  if (e1) throw new Error(e1.message);
  const today = nyDay(now);
  const toEditing = (scheduled ?? []).filter((b) => nyDay(new Date(endOf(b))) < today).map((b) => b.id);

  let archived = 0;
  if (archiveAfterDays) {
    const { data: old, error: e3 } = await db.from("bookings").select("id").eq("status", "delivered").lt("delivered_at", new Date(t - archiveAfterDays * DAY_MS).toISOString());
    if (e3) throw new Error(e3.message);
    archived = await setStatus(db, (old ?? []).map((b) => b.id), "archived");
  }
  return { editing: await setStatus(db, toEditing, "editing"), shootCompleted: 0, archived };
}

type ReminderRow = MessageBooking & { id: string; status: string; client_email: string | null; payment_state: string; project_title: string | null; package_name: string | null };
const COLS = "id, status, client_name, client_email, project_title, package_name, shoot_start, location, balance_cents, due_date, payment_state, payment_link_url, payment_link_cents";
const asMessage = (b: ReminderRow): MessageBooking => ({ ...b, project: b.project_title || b.package_name || "your project" });

export async function runClientReminders(db: AdminSupabaseClient, now: Date, studio: { name: string; email: string | null }, reminderDays: number) {
  const today = nyDay(now);
  const tomorrow = addDays(today, 1);
  const counts = { shoot: 0, dueSoon: 0, overdue: 0, failed: 0 };
  const tally = (r: string, key: keyof typeof counts) => { if (r === "sent") counts[key] += 1; if (r === "failed") counts.failed += 1; };

  const { data: shoots, error: e1 } = await db.from("booking_ledger").select(COLS).neq("status", "canceled")
    .gte("shoot_start", startOfNyDay(tomorrow).toISOString()).lt("shoot_start", startOfNyDay(addDays(tomorrow, 1)).toISOString());
  if (e1) throw new Error(e1.message);
  for (const b of (shoots ?? []) as ReminderRow[]) {
    if (!b.client_email) continue;
    // Keyed by date: a rescheduled shoot gets a fresh reminder.
    tally(await deliverOnce(db, { bookingId: b.id, kind: "shoot_reminder", dedupeKey: `shoot_reminder:${b.id}:${tomorrow}`, to: b.client_email, replyTo: studio.email, ...shootReminder(asMessage(b), studio) }), "shoot");
  }

  const { data: owing, error: e2 } = await db.from("booking_ledger").select(COLS).gt("balance_cents", 0).not("due_date", "is", null).lte("due_date", addDays(today, reminderDays));
  if (e2) throw new Error(e2.message);
  for (const b of (owing ?? []) as ReminderRow[]) {
    if (!b.client_email || !isCommitted(b)) continue;
    const overdue = b.due_date! < today;
    // One "due soon" note when it is exactly N days out, and one notice once overdue.
    if (!overdue && b.due_date !== addDays(today, reminderDays)) continue;
    const kind = overdue ? "balance_overdue" : "balance_due";
    tally(await deliverOnce(db, { bookingId: b.id, kind, dedupeKey: `${kind}:${b.id}:${b.due_date}`, to: b.client_email, replyTo: studio.email, ...balanceReminder(asMessage(b), studio, overdue) }), overdue ? "overdue" : "dueSoon");
  }
  return counts;
}

export async function syncDailyCalPrices(db: AdminSupabaseClient, now: Date) {
  const today = nyDay(now);
  const [packages, promotionResult] = await Promise.all([
    catalogPackages(db),
    db.from("promotions").select("package_id, original_price_cents, discounted_price_cents, booking_deadline").eq("enabled", true).lte("starts_on", today).gte("ends_on", today),
  ]);
  if (promotionResult.error) throw new Error(promotionResult.error.message);
  const packagePrices = new Map(packages.map((pkg) => [pkg.id, pkg.price]));
  const promotions = new Map((promotionResult.data ?? []).filter((promotion) =>
    (!promotion.booking_deadline || promotion.booking_deadline >= today) && packagePrices.get(promotion.package_id) === promotion.original_price_cents
  ).map((promotion) => [promotion.package_id, promotion.discounted_price_cents]));
  const result = { synced: 0, failed: 0 };
  for (const pkg of packages) {
    if (pkg.inquiryOnly || !calEvents()[pkg.id]) continue;
    try {
      await syncCatalogPackage(pkg, promotions.get(pkg.id) ?? pkg.price);
      result.synced += 1;
    } catch (error) {
      console.error(`Daily Cal.com sync failed for ${pkg.id}`, error);
      result.failed += 1;
    }
  }
  return result;
}

export async function runDailyAutomation(db: AdminSupabaseClient, now = new Date()) {
  const settings = await studioSettings(db);
  const status = settings.autoStatus ? await runStatusAutomation(db, now, settings.archiveAfterDays) : "disabled";
  const reminders = settings.clientEmails ? await runClientReminders(db, now, settings, settings.reminderDays) : "disabled";
  const calendar = await syncDailyCalPrices(db, now);
  return { ranAt: now.toISOString(), status, reminders, calendar };
}
