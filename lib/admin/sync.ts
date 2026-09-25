import "server-only";
import { bookingAddons, bookingPackages } from "@/data/booking";
import { bookingStore, type PaidReceipt, type StripeReceipt } from "@/lib/booking/store";
import type { BookingRecord } from "@/lib/booking/reconcile";
import { createSupabaseService } from "@/lib/supabase/service";
import { statusRank, type BookingStatus, type LeadSource } from "./labels";

// Mirrors a website booking (kept in Redis by the booking flow) into the admin
// database. Called from both provider webhooks after reconciliation, so it runs on
// every change. It is idempotent: keyed by the portal reference and the Stripe
// PaymentIntent id, so retries and out-of-order deliveries converge.
// If it throws, the webhook answers 503 and the provider retries.

type Db = NonNullable<ReturnType<typeof createSupabaseService>>;

const STATE_TO_STATUS: Record<string, BookingStatus> = {
  awaiting_payment: "deposit_pending", paid_deposit: "deposit_paid", confirmed: "confirmed", cancelled: "canceled",
};

export function leadSourceFrom(text?: string): { source: LeadSource; detail: string | null } {
  const t = (text || "").trim();
  const l = t.toLowerCase();
  const match = ([
    ["instagram", /insta|\big\b/], ["tiktok", /tik ?tok/], ["youtube", /youtube|\byt\b/], ["google", /google|search/],
    ["linkedin", /linked ?in/], ["repeat_client", /repeat|worked (with|together) before|returning/], ["referral", /refer|friend|word of mouth|recommend/],
  ] as [LeadSource, RegExp][]).find(([, re]) => re.test(l));
  return { source: match?.[0] ?? (t ? "other" : "website"), detail: t || null };
}

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
  const shoot = { cal_uid: record.uid, shoot_start: record.start, shoot_end: record.end, location: record.intake.location || null };
  if (existing) {
    const { error: e } = await db.from("bookings").update(shoot).eq("id", existing.id);
    if (e) throw e;
    return existing as { id: string; status: BookingStatus };
  }
  const lead = leadSourceFrom(record.intake.referral);
  const { data, error: insertError } = await db.from("bookings").insert({
    ...shoot, reference: record.reference, client_id: clientId, source: "website", status: "deposit_pending",
    package_id: record.intake.packageId, package_name: record.packageName, service_category: pkg?.category ?? null,
    project_title: record.packageName, project_description: record.intake.project, client_message: record.intake.references || null,
    package_price_cents: pkg?.price ?? record.total, addons_cents: record.total - (pkg?.price ?? record.total),
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
  if (payment.amount <= 0) return; // Nothing was captured, so there is nothing to record.
  const status = payment.status !== "succeeded" ? "pending"
    : payment.refunded >= payment.amount ? "refunded" : payment.refunded > 0 ? "partially_refunded" : "succeeded";
  const refunded = Math.min(payment.refunded, payment.amount);
  const { data: existing, error } = await db.from("payments").select("id").eq("stripe_payment_intent_id", payment.id).maybeSingle();
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
}

export async function syncBookingToAdmin(uid: string) {
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
  if (paid && payment) await upsertStripePayment(db, booking.id, payment, record.paymentOption === "full" ? "final" : "deposit", paid.paymentId);

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
