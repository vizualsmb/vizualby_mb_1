import "server-only";
import { bookingAddons, bookingPackages } from "@/data/booking";
import { bookingStore, type PaidReceipt, type StripeReceipt } from "@/lib/booking/store";
import type { BookingRecord } from "@/lib/booking/reconcile";
import { createSupabaseService } from "@/lib/supabase/service";
import { leadSourceFrom, statusRank, type BookingStatus } from "./labels";
import { adminNewBooking, adminPaymentReceived, type MessageBooking } from "./messages";
import { adminInbox, adminSiteUrl, deliverOnce, studioSettings } from "./notify";
import { normalizePhone } from "./sms";
import { bookingConfirmationSms, bookingReminderSms } from "./sms-messages";

// Mirrors a website booking (kept in Redis by the booking flow) into the admin
// database. Called from both provider webhooks after reconciliation, so it runs on
// every change. It is idempotent: keyed by the portal reference and the Stripe
// PaymentIntent id, so retries and out-of-order deliveries converge.
// If it throws, the webhook answers 503 and the provider retries.

type Db = NonNullable<ReturnType<typeof createSupabaseService>>;

const STATE_TO_STATUS: Record<string, BookingStatus> = {
  awaiting_payment: "deposit_pending", paid_deposit: "deposit_paid", confirmed: "confirmed", cancelled: "canceled",
};

async function upsertClient(db: Db, record: BookingRecord) {
  const { intake } = record;
  const { data: existing, error } = await db.from("clients").select("id, phone, company, social").eq("email", intake.email).maybeSingle();
  if (error) throw error;
  if (existing) {
    // Fill gaps only; never overwrite details edited in the admin.
    const patch = Object.fromEntries(Object.entries({ phone: intake.phone, company: intake.company, social: intake.social })
      .filter(([k, v]) => v && !existing[k as keyof typeof existing]));
    if (Object.keys(patch).length) { const { error: e } = await db.from("clients").update(patch).eq("id", existing.id); if (e) throw e; }
    return existing.id as string;
  }
  const { data, error: insertError } = await db.from("clients")
    .upsert({ name: intake.name, email: intake.email, phone: intake.phone, company: intake.company || null, social: intake.social || null }, { onConflict: "email", ignoreDuplicates: false })
    .select("id").single();
  if (insertError) throw insertError;
  return data.id as string;
}

async function upsertBooking(db: Db, record: BookingRecord, clientId: string) {
  const { data: existing, error } = await db.from("bookings").select("id, status").eq("reference", record.reference).maybeSingle();
  if (error) throw error;
  const pkg = bookingPackages.find((p) => p.id === record.intake.packageId);
  const addons = bookingAddons.filter((a) => record.intake.addonIds.includes(a.id));
  const shoot = {
    cal_uid: record.uid,
    shoot_start: record.start,
    shoot_end: record.end,
    location: record.intake.location || null,
    // Preserve the website intake time during historical imports instead of
    // making old bookings look newly created on the day they were backfilled.
    created_at: record.acceptedAt,
    assistant_client_id: record.assistantClientId ?? null,
    assistant_draft_id: record.assistantDraftId ?? null,
  };
  if (existing) {
    const { error: e } = await db.from("bookings").update(shoot).eq("id", existing.id);
    if (e) throw e;
    return existing as { id: string; status: BookingStatus };
  }
  const lead = leadSourceFrom(record.intake.referral);
  const { data, error: insertError } = await db.from("bookings").insert({
    ...shoot, reference: record.reference, client_id: clientId, source: "website", status: "deposit_pending",
    package_id: record.intake.packageId, package_name: record.packageName, service_category: record.packageCategory ?? pkg?.category ?? null,
    project_title: record.packageName, project_description: record.intake.project, client_message: record.intake.references || null,
    package_price_cents: record.packagePrice ?? pkg?.price ?? record.total,
    original_package_price_cents: record.originalPrice ?? pkg?.price ?? record.total,
    promotion_id: record.promotionId ?? null, promotion_savings_cents: record.savings ?? 0,
    addons_cents: record.total - (record.packagePrice ?? pkg?.price ?? record.total),
    deposit_required_cents: record.deposit, lead_source: lead.source, lead_source_detail: lead.detail, policy_version: record.policyVersion,
  }).select("id, status").single();
  if (insertError) throw insertError;
  if (addons.length) {
    const { error: e } = await db.from("booking_addons").upsert(addons.map((a) => ({ booking_id: data.id, addon_id: a.id, name: a.name, price_cents: a.price })));
    if (e) throw e;
  }
  return data as { id: string; status: BookingStatus };
}

export async function upsertStripePayment(db: Db, bookingId: string, payment: StripeReceipt, type: "deposit" | "final" | "partial", calPaymentId?: number) {
  if (payment.amount <= 0) return false; // Nothing was captured, so there is nothing to record.
  const status = payment.status !== "succeeded" ? "pending"
    : payment.refunded >= payment.amount ? "refunded" : payment.refunded > 0 ? "partially_refunded" : "succeeded";
  const refunded = Math.min(payment.refunded, payment.amount);
  const { data: existing, error } = await db.from("payments").select("id, status").eq("stripe_payment_intent_id", payment.id).maybeSingle();
  if (error) throw error;
  // Later events (refunds) update status only; the original payment date is kept.
  const write = existing
    ? db.from("payments").update({ status, refunded_cents: refunded }).eq("id", existing.id)
    : db.from("payments").insert({
      booking_id: bookingId, type, method: "stripe", status, amount_cents: payment.amount, refunded_cents: refunded,
      paid_at: new Date(payment.updatedAt * 1000).toISOString(), stripe_payment_intent_id: payment.id, cal_payment_id: calPaymentId ?? null,
    });
  const { error: writeError } = await write;
  if (writeError) throw writeError;
  return status === "succeeded" && existing?.status !== "succeeded"; // true the first time it succeeds
}

async function alertAdmin(db: Db, bookingId: string, kind: "new_booking" | "payment", dedupeKey: string, amount = 0) {
  const settings = await studioSettings(db);
  const to = adminInbox();
  if (!settings.adminEmails || !to) return;
  const { data: b } = await db.from("booking_ledger").select("client_name, project_title, package_name, shoot_start, location, balance_cents, due_date, payment_link_url, payment_link_cents").eq("id", bookingId).single();
  if (!b) return;
  const booking: MessageBooking = { ...b, project: b.project_title || b.package_name || "a project" };
  const url = `${adminSiteUrl()}/admin/bookings/${bookingId}`;
  const msg = kind === "new_booking" ? adminNewBooking(booking, url) : adminPaymentReceived(booking, amount, url);
  await deliverOnce(db, { bookingId, kind: `admin_${kind}`, dedupeKey, to, ...msg });
}

// A balance paid through an admin-created Stripe payment link (metadata.admin_booking_id).
export async function syncLinkedStripePayment(bookingId: string, payment: StripeReceipt, type: "final" | "partial") {
  const db = createSupabaseService();
  if (!db || !/^[0-9a-f-]{36}$/i.test(bookingId)) return;
  const { data: booking, error } = await db.from("bookings").select("id").eq("id", bookingId).maybeSingle();
  if (error) throw error;
  if (!booking) return; // Unknown booking: never attach money to a guess.
  // Clear the used link only on the first success, so a late retry cannot clear a newer link.
  if (await upsertStripePayment(db, bookingId, payment, type)) {
    const { error: clearError } = await db.from("bookings").update({ payment_link_id: null, payment_link_url: null, payment_link_cents: null }).eq("id", bookingId);
    if (clearError) throw clearError;
  }
  // Alerts are deduplicated by the notifications log, so retries are safe and never lose one.
  if (payment.status === "succeeded") await alertAdmin(db, bookingId, "payment", `admin_payment:${payment.id}`, payment.amount);
}

export async function syncBookingToAdmin(uid: string, options: { notify?: boolean } = {}) {
  const db = createSupabaseService();
  if (!db) return; // Admin database not set up yet: the booking flow must keep working.
  const store = bookingStore();
  const record = await store.get<BookingRecord>(`booking:record:${uid}`);
  // A rescheduled booking's old uid points to its replacement, which carries the same reference.
  if (!record || record.state === "rescheduled") return;
  const clientId = await upsertClient(db, record);
  const booking = await upsertBooking(db, record, clientId);

  const paid = await store.hget<PaidReceipt>(`booking:cal:${uid}`, "paid");
  const payment = paid ? await store.get<StripeReceipt>(`booking:stripe:${paid.stripePaymentIntentId}`) : null;
  if (options.notify !== false) {
    await alertAdmin(db, booking.id, "new_booking", `admin_new_booking:${booking.id}`);
  }
  if (paid && payment) {
    await upsertStripePayment(db, booking.id, payment, record.paymentOption === "full" ? "final" : "deposit", paid.paymentId);
    if (options.notify !== false && payment.status === "succeeded") {
      await alertAdmin(db, booking.id, "payment", `admin_payment:${payment.id}`, payment.amount);
    }
  }

  // Automation only moves early statuses forward (or cancels); it never overrides
  // a status you set by hand later in the pipeline.
  // Cal's lifecycle catches cancellations of bookings that were never paid.
  const lifecycle = await store.hget<{ state: string }>(`booking:cal:${uid}`, "lifecycle");
  const state = lifecycle && ["cancelled", "rejected"].includes(lifecycle.state) ? "cancelled" : record.state;
  const next = STATE_TO_STATUS[state];
  const early = statusRank(booking.status) <= statusRank("confirmed");
  if (next && next !== booking.status && early && (next === "canceled" || statusRank(next) > statusRank(booking.status))) {
    const { error } = await db.from("bookings").update({ status: next, ...(next === "canceled" ? { canceled_at: new Date().toISOString() } : {}) }).eq("id", booking.id);
    if (error) throw error;
  }
  if (state === "needs_review") {
    const { data: flagged } = await db.from("booking_events").select("id").eq("booking_id", booking.id).eq("kind", "needs_review").limit(1);
    if (!flagged?.length) await db.from("booking_events").insert({ booking_id: booking.id, kind: "needs_review", actor: "system", detail: "Payment details did not match the quote. Check Stripe and Cal before confirming." });
  }
}

type SmsBooking = { id: string; client_name: string; client_phone: string | null; project_title: string | null; package_name: string | null; shoot_start: string | null; location: string | null; status: string };

async function smsBooking(db: Db, booking: SmsBooking, kind: "confirmation" | "reminder", studioName: string) {
  const phone = booking.client_phone ? normalizePhone(booking.client_phone) : null;
  if (!phone) {
    // Safe operational log: never include the submitted phone number.
    console.warn("sms skipped: invalid or missing phone", { bookingId: booking.id, kind });
    return "unconfigured" as const;
  }
  const project = booking.project_title || booking.package_name || "your production";
  const text = kind === "confirmation"
    ? bookingConfirmationSms({ ...booking, project }, studioName)
    : bookingReminderSms({ ...booking, project }, studioName);
  return deliverOnce(db, {
    bookingId: booking.id,
    kind: `client_sms_${kind}`,
    channel: "sms",
    dedupeKey: `client_sms:${kind}:${booking.id}:${kind === "reminder" ? booking.shoot_start : "confirmed"}`,
    to: phone,
    text,
  });
}

export async function sendBookingConfirmationSms(uid: string) {
  const db = createSupabaseService();
  if (!db) return "unconfigured" as const;
  const { data, error } = await db.from("booking_ledger")
    .select("id, client_name, client_phone, project_title, package_name, shoot_start, location, status")
    .eq("cal_uid", uid).maybeSingle();
  if (error) { console.error("booking confirmation SMS lookup failed", { bookingUid: uid, error: error.message.slice(0, 160) }); return "failed" as const; }
  if (!data || data.status !== "confirmed") return "unconfigured" as const;
  const settings = await studioSettings(db);
  return smsBooking(db, data as SmsBooking, "confirmation", settings.name);
}

export async function sendBookingReminderSms(db: Db, now = new Date()) {
  const from = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
  const to = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db.from("booking_ledger")
    .select("id, client_name, client_phone, project_title, package_name, shoot_start, location, status")
    .in("status", ["confirmed", "pre_production", "shoot_scheduled"])
    .gte("shoot_start", from).lt("shoot_start", to);
  if (error) throw new Error(error.message);
  const settings = await studioSettings(db);
  const counts = { sent: 0, duplicate: 0, failed: 0, skipped: 0 };
  for (const booking of (data ?? []) as SmsBooking[]) {
    const result = await smsBooking(db, booking, "reminder", settings.name);
    if (result === "sent") counts.sent += 1;
    else if (result === "duplicate") counts.duplicate += 1;
    else if (result === "failed") counts.failed += 1;
    else counts.skipped += 1;
  }
  return counts;
}

// Imports bookings that were created before the admin database was connected.
// Redis SCAN is incremental (never blocks the store with KEYS), and each booking
// uses the same idempotent upsert path as the live webhooks.
export async function syncExistingBookingsToAdmin() {
  const db = createSupabaseService();
  if (!db) throw new Error("The admin database is not configured.");
  const store = bookingStore();
  let cursor = 0;
  let found = 0;
  let synced = 0;
  let skipped = 0;

  do {
    const [next, keys] = await store.scan(cursor, { match: "booking:record:*", count: 100 });
    cursor = Number(next);
    for (const key of keys) {
      found += 1;
      const uid = key.slice("booking:record:".length);
      const record = await store.get<BookingRecord>(key);
      if (!record || record.state === "rescheduled") {
        skipped += 1;
        continue;
      }
      await syncBookingToAdmin(uid, { notify: false });
      synced += 1;
    }
  } while (cursor !== 0);

  return { found, synced, skipped };
}
