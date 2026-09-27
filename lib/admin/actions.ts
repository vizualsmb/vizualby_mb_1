"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bookingPackages } from "@/data/booking";
import { requireAdmin } from "./auth";
import { parseCents, usd } from "./money";
import { adminStripe, bookingSiteUrl } from "./stripe";
import { runDailyAutomation } from "./automation";
import { createSupabaseService } from "@/lib/supabase/service";
import { nyInstant } from "./time";
import { BOOKING_STATUSES, CLIENT_TYPES, EXPENSE_CATEGORIES, LEAD_SOURCES, PAYMENT_METHODS, PAYMENT_TYPES, keysOf } from "./labels";
import { syncExistingBookingsToAdmin } from "./sync";
import { catalogPackages } from "@/lib/booking/catalog.server";
import { calEvents } from "@/lib/booking/config";
import { rollbackCalPackage, syncCalPackage, syncCatalogPackage } from "@/lib/booking/cal-sync";

// Every action authorizes itself (requireAdmin) and validates its input. The proxy
// is not a security boundary for Server Functions.

export type ActionState = { ok?: boolean; error?: string; message?: string };

const enumOf = <T extends object>(o: T) => z.enum(keysOf(o) as unknown as [string, ...string[]]);
const uuid = z.uuid();
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const text = (max: number) => z.string().trim().max(max).transform((s) => s || null);
const optional = <T extends z.ZodType>(s: T) => z.preprocess((v) => (v === "" || v === null ? undefined : v), s.optional());
const form = (fd: FormData) => Object.fromEntries(fd.entries());

async function audit(action: string, entity: string, entityId: string | null, data?: unknown) {
  const { supabase, userId } = await requireAdmin();
  await supabase.from("audit_logs").insert({ actor_id: userId, action, entity, entity_id: entityId, data: data ?? null });
}
const fail = (error: string): ActionState => ({ error });

function promotionIsLive(promotion: { enabled: boolean; starts_on: string; ends_on: string; booking_deadline: string | null }, today: string) {
  return promotion.enabled && promotion.starts_on <= today && promotion.ends_on >= today && (!promotion.booking_deadline || promotion.booking_deadline >= today);
}

// ── Bookings ─────────────────────────────────────────────────────────────────
export async function updateBookingStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ id: uuid, status: z.enum(BOOKING_STATUSES.map(([s]) => s) as [string, ...string[]]) }).safeParse(form(fd));
  if (!input.success) return fail("Choose a valid status.");
  if (input.data.status === "paid") {
    const { data: booking, error: lookupError } = await supabase.from("booking_ledger").select("balance_cents").eq("id", input.data.id).maybeSingle();
    if (lookupError || !booking) return fail("Booking not found.");
    if (booking.balance_cents > 0) return fail(`This booking still has ${usd(booking.balance_cents)} due. Record the final payment before marking it paid.`);
  }
  const patch: Record<string, unknown> = { status: input.data.status };
  if (input.data.status === "canceled") patch.canceled_at = new Date().toISOString();
  if (input.data.status === "delivered") patch.delivered_at = new Date().toISOString();
  const { error } = await supabase.from("bookings").update(patch).eq("id", input.data.id);
  if (error) return fail("Could not update the status. Try again.");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Status updated" };
}

export async function updateBookingDetails(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    id: uuid, project_title: text(160), location: text(250), notes: text(5000),
    shoot_day: optional(day), shoot_time: optional(time), duration_hours: optional(z.coerce.number().min(0.25).max(72)),
    balance_due_date: optional(day), lead_source: optional(enumOf(LEAD_SOURCES)),
    adjustment: z.string().trim().max(20), deposit: z.string().trim().max(20),
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the booking details and try again.");
  const d = input.data;
  const adjustment = d.adjustment ? parseSigned(d.adjustment) : 0;
  const deposit = d.deposit ? parseCents(d.deposit) : undefined;
  if (adjustment === null || deposit === null) return fail("Amounts must look like 150 or 150.00 (use -50 for a discount).");
  const patch: Record<string, unknown> = {
    project_title: d.project_title, location: d.location, notes: d.notes, balance_due_date: d.balance_due_date ?? null,
    lead_source: d.lead_source ?? null, adjustment_cents: adjustment,
  };
  if (deposit !== undefined) patch.deposit_required_cents = deposit;
  if (d.shoot_day) {
    const start = nyInstant(d.shoot_day, d.shoot_time ?? "12:00");
    patch.shoot_start = start.toISOString();
    patch.shoot_end = d.duration_hours ? new Date(start.getTime() + d.duration_hours * 3600000).toISOString() : null;
  }
  const { error } = await supabase.from("bookings").update(patch).eq("id", d.id);
  if (error) return fail(error.message.includes("total_cents") ? "A discount cannot make the total negative." : "Could not save the booking.");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved" };
}

function parseSigned(s: string) {
  const negative = s.trim().startsWith("-");
  const cents = parseCents(s.replace(/^\s*-/, ""));
  return cents === null ? null : negative ? -cents : cents;
}

export async function addBookingNote(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ id: uuid, note: z.string().trim().min(1).max(1000) }).safeParse(form(fd));
  if (!input.success) return fail("Write a short note first.");
  const { error } = await supabase.from("booking_events").insert({ booking_id: input.data.id, kind: "note", detail: input.data.note, actor: "admin" });
  if (error) return fail("Could not add the note.");
  revalidatePath(`/admin/bookings/${input.data.id}`);
  return { ok: true, message: "Added to timeline" };
}

export async function createBooking(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    client_id: optional(uuid), client_name: text(120), client_email: optional(z.email().max(160)), client_phone: text(30),
    package_id: z.string().max(60), project_title: text(160), price: z.string().trim().max(20), deposit: z.string().trim().max(20),
    shoot_day: optional(day), shoot_time: optional(time), duration_hours: optional(z.coerce.number().min(0.25).max(72)),
    location: text(250), lead_source: optional(enumOf(LEAD_SOURCES)), status: z.enum(BOOKING_STATUSES.map(([s]) => s) as [string, ...string[]]),
    notes: text(5000),
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the required fields: client, price and status.");
  const d = input.data;
  const pkg = (await catalogPackages(supabase)).find((p) => p.id === d.package_id);
  const price = d.price ? parseCents(d.price) : pkg?.price ?? null;
  const deposit = d.deposit ? parseCents(d.deposit) : pkg?.deposit ?? 0;
  if (price === null || deposit === null) return fail("Enter the agreed price, e.g. 750.");
  if (d.status === "paid" && price > 0) return fail("Create the booking first, then record its payment before marking it paid.");

  let clientId = d.client_id;
  if (!clientId) {
    if (!d.client_name) return fail("Choose an existing client or enter a name.");
    const email = d.client_email?.toLowerCase() ?? null;
    const existing = email ? (await supabase.from("clients").select("id").eq("email", email).maybeSingle()).data : null;
    if (existing) clientId = existing.id;
    else {
      const { data, error } = await supabase.from("clients").insert({ name: d.client_name, email, phone: d.client_phone }).select("id").single();
      if (error) return fail("Could not create the client.");
      clientId = data.id;
    }
  }
  const start = d.shoot_day ? nyInstant(d.shoot_day, d.shoot_time ?? "12:00") : null;
  const minutes = d.duration_hours ? d.duration_hours * 60 : pkg?.minutes || 0;
  const { data, error } = await supabase.from("bookings").insert({
    client_id: clientId, source: "manual", status: d.status, package_id: pkg?.id ?? null, package_name: pkg?.name ?? null,
    service_category: pkg?.category ?? "custom", project_title: d.project_title ?? pkg?.name ?? "Custom project",
    package_price_cents: price, deposit_required_cents: deposit, location: d.location, lead_source: d.lead_source ?? null, notes: d.notes,
    shoot_start: start?.toISOString() ?? null, shoot_end: start && minutes ? new Date(start.getTime() + minutes * 60000).toISOString() : null,
  }).select("id").single();
  if (error) return fail("Could not create the booking.");
  revalidatePath("/admin", "layout");
  redirect(`/admin/bookings/${data.id}`);
}

// ── Payments ─────────────────────────────────────────────────────────────────
export async function recordPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    booking_id: uuid, amount: z.string().max(20), type: enumOf(PAYMENT_TYPES), method: enumOf(PAYMENT_METHODS),
    paid_on: day, notes: text(500),
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the payment details.");
  const amount = parseCents(input.data.amount);
  if (!amount) return fail("Enter an amount, e.g. 250.");
  // Stripe payments arrive by webhook; recording one here would double count it.
  if (input.data.method === "stripe") return fail("Stripe payments sync automatically. Record cash, Zelle, Venmo and other off-Stripe payments here.");
  const { error } = await supabase.from("payments").insert({
    booking_id: input.data.booking_id, amount_cents: amount, type: input.data.type, method: input.data.method,
    status: "succeeded", paid_at: nyInstant(input.data.paid_on, "12:00").toISOString(), notes: input.data.notes,
  });
  if (error) return fail("Could not record the payment.");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Payment recorded" };
}

export async function refundManualPayment(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ id: uuid, amount: z.string().max(20) }).safeParse(form(fd));
  const amount = input.success ? parseCents(input.data.amount) : null;
  if (!input.success || !amount) return fail("Enter the refunded amount.");
  const { data: payment } = await supabase.from("payments").select("amount_cents, refunded_cents, method").eq("id", input.data.id).single();
  if (!payment) return fail("Payment not found.");
  if (payment.method === "stripe") return fail("Refund Stripe payments in Stripe; the refund syncs here automatically.");
  const refunded = Math.min(payment.amount_cents, payment.refunded_cents + amount);
  const { error } = await supabase.from("payments").update({ refunded_cents: refunded, status: refunded >= payment.amount_cents ? "refunded" : "partially_refunded" }).eq("id", input.data.id);
  if (error) return fail("Could not record the refund.");
  await audit("refund", "payment", input.data.id, { amount });
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Refund recorded" };
}

// ── Clients ──────────────────────────────────────────────────────────────────
export async function updateClient(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    id: uuid, name: z.string().trim().min(1).max(120), email: optional(z.email().max(160)), phone: text(30), company: text(120),
    social: text(200), client_type: enumOf(CLIENT_TYPES), notes: text(5000),
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the client details.");
  const { id, email, ...rest } = input.data;
  const { error } = await supabase.from("clients").update({ ...rest, email: email?.toLowerCase() ?? null }).eq("id", id);
  if (error) return fail(error.code === "23505" ? "Another client already uses that email." : "Could not save the client.");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Saved" };
}

export async function removeClient(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return fail("Client not found.");
  const { data: removed, error } = await supabase.from("clients").update({ archived_at: new Date().toISOString() }).eq("id", id.data).is("archived_at", null).select("id, name, email").maybeSingle();
  if (error) return fail("Could not remove this client.");
  if (!removed) return fail("Client not found or already removed.");
  await audit("remove", "client", id.data, removed);
  revalidatePath("/admin", "layout");
  redirect("/admin/clients");
}

// ── Expenses ─────────────────────────────────────────────────────────────────
const RECEIPT_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf" };

export async function addExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    name: z.string().trim().min(1).max(160), amount: z.string().max(20), spent_on: day, category: enumOf(EXPENSE_CATEGORIES),
    vendor: text(120), booking_id: optional(uuid), payment_method: optional(enumOf(PAYMENT_METHODS)), notes: text(1000),
  }).safeParse(Object.fromEntries([...fd.entries()].filter(([k]) => k !== "receipt")));
  if (!input.success) return fail("Name, amount, date and category are required.");
  const amount = parseCents(input.data.amount);
  if (!amount) return fail("Enter an amount, e.g. 45.99.");
  const receipt = fd.get("receipt");
  const file = receipt instanceof File && receipt.size > 0 ? receipt : null;
  if (file && (!RECEIPT_TYPES[file.type] || file.size > 4 * 1024 * 1024)) return fail("Receipts must be a JPG, PNG, WebP or PDF under 4 MB.");

  const { name, spent_on, category, vendor, booking_id, payment_method, notes } = input.data;
  const { data: expense, error } = await supabase.from("expenses")
    .insert({ name, spent_on, category, vendor, notes, amount_cents: amount, booking_id: booking_id ?? null, payment_method: payment_method ?? null })
    .select("id").single();
  if (error) return fail("Could not save the expense.");
  revalidatePath("/admin", "layout");
  if (!file) return { ok: true, message: "Expense added" };

  const path = `${spent_on.slice(0, 4)}/${expense.id}.${RECEIPT_TYPES[file.type]}`;
  const { error: uploadError } = await supabase.storage.from("vizualby-mb-receipts").upload(path, file, { contentType: file.type, upsert: false });
  if (uploadError) return { ok: true, message: "Expense added, but the receipt did not upload. Try again from a smaller file." };
  await supabase.from("expenses").update({ receipt_path: path }).eq("id", expense.id);
  return { ok: true, message: "Expense and receipt saved" };
}

export async function deleteExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return fail("Expense not found.");
  const { data: removed, error } = await supabase.from("expenses").delete().eq("id", id.data).select("name, amount_cents, spent_on, receipt_path").maybeSingle();
  if (error) return fail("Could not delete the expense.");
  if (removed?.receipt_path) await supabase.storage.from("vizualby-mb-receipts").remove([removed.receipt_path]);
  await audit("delete", "expense", id.data, removed);
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Expense deleted" };
}

// ── Settings ─────────────────────────────────────────────────────────────────
export async function updateSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    business_name: z.string().trim().min(1).max(120), email: optional(z.email().max(160)), phone: text(30), address: text(300),
    default_deposit_percent: z.coerce.number().min(0).max(100), tax_percent: z.coerce.number().min(0).max(100),
    invoice_terms: text(3000), cancellation_terms: text(3000), payment_terms: text(3000),
    reminder_days_before_due: z.coerce.number().int().min(0).max(30),
    archive_after_days: optional(z.coerce.number().int().min(1).max(365)),
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the settings values.");
  // Unchecked checkboxes are absent from form data, so read them explicitly.
  const toggles = Object.fromEntries(["client_emails_enabled", "admin_emails_enabled", "auto_status_enabled"].map((k) => [k, fd.get(k) === "on"]));
  const { error } = await supabase.from("business_settings").update({ ...input.data, ...toggles, email: input.data.email ?? null, archive_after_days: input.data.archive_after_days ?? null }).eq("id", true);
  if (error) return fail("Could not save settings.");
  await audit("update", "business_settings", null, { ...input.data, ...toggles });
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved" };
}

export async function savePromotion(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  if (fd.get("intent") === "delete") {
    const id = uuid.safeParse(fd.get("id"));
    if (!id.success) return fail("Deal not found.");
    const { data: promotion } = await supabase.from("promotions").select("*").eq("id", id.data).maybeSingle();
    if (!promotion) return fail("Deal not found.");
    const pkg = (await catalogPackages(supabase)).find((item) => item.id === promotion.package_id);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
    let calBefore: Awaited<ReturnType<typeof syncCalPackage>> | null = null;
    if (pkg && calEvents()[pkg.id] && promotionIsLive(promotion, today)) {
      try { calBefore = await syncCatalogPackage(pkg, pkg.price); }
      catch (error) {
        console.error("Cal.com deal deletion sync failed", error);
        return fail("Cal.com could not restore the regular package price, so the deal was not deleted.");
      }
    }
    const { error } = await supabase.from("promotions").delete().eq("id", id.data);
    if (error) {
      if (calBefore) await rollbackCalPackage(calBefore).catch((rollbackError) => console.error("Cal.com rollback failed after deal deletion error", rollbackError));
      return fail("Could not delete this deal.");
    }
    await audit("delete", "promotion", id.data, { package_id: promotion.package_id });
    revalidatePath("/admin/services"); revalidatePath("/booking");
    return { ok: true, message: "Deal deleted and regular pricing restored" };
  }
  const input = z.object({
    id: optional(uuid), package_id: z.string().trim().min(1).max(60),
    original_price: z.string().trim().max(20), discounted_price: z.string().trim().max(20),
    discount_type: z.enum(["flat", "percentage"]), label: text(40), value_note: text(160),
    starts_on: day, ends_on: day, booking_deadline: optional(day),
    limited_quantity: optional(z.coerce.number().int().min(1).max(10000)), promo_code: text(40),
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the package, prices, dates, and optional limits.");
  const d = input.data;
  const pkg = (await catalogPackages(supabase)).find((item) => item.id === d.package_id && !item.inquiryOnly);
  const original = parseCents(d.original_price);
  const discounted = parseCents(d.discounted_price);
  if (!pkg || !original || !discounted) return fail("Choose a bookable package and enter valid prices.");
  if (original !== pkg.price) return fail(`The original price must match the package price (${usd(pkg.price)}). Change the package first if needed.`);
  if (discounted >= original) return fail("The deal price must be lower than the original price.");
  if (d.ends_on < d.starts_on) return fail("The end date must be on or after the start date.");
  if (d.booking_deadline && (d.booking_deadline < d.starts_on || d.booking_deadline > d.ends_on)) return fail("The booking deadline must fall within the offer dates.");
  const row = {
    package_id: d.package_id, enabled: fd.get("enabled") === "on", original_price_cents: original,
    discounted_price_cents: discounted, discount_type: d.discount_type, label: d.label,
    value_note: d.value_note, starts_on: d.starts_on, ends_on: d.ends_on,
    booking_deadline: d.booking_deadline ?? null, limited_quantity: d.limited_quantity ?? null,
    promo_code: d.promo_code ? d.promo_code.toUpperCase() : null,
  };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const prior = d.id ? (await supabase.from("promotions").select("enabled, starts_on, ends_on, booking_deadline").eq("id", d.id).maybeSingle()).data : null;
  const needsCalSync = !!calEvents()[d.package_id] && (promotionIsLive(row, today) || (!!prior && promotionIsLive(prior, today)));
  let calBefore: Awaited<ReturnType<typeof syncCalPackage>> | null = null;
  if (needsCalSync) {
    try {
      calBefore = await syncCatalogPackage(pkg, promotionIsLive(row, today) ? discounted : pkg.price);
    } catch (error) {
      console.error("Cal.com promotion sync failed", error);
      return fail("Cal.com could not confirm the deal price. Nothing was changed. Check the event connection and try again.");
    }
  }
  const result = d.id ? await supabase.from("promotions").update(row).eq("id", d.id) : await supabase.from("promotions").insert(row);
  if (result.error) {
    if (calBefore) {
      try { await rollbackCalPackage(calBefore); }
      catch (rollbackError) { console.error("Cal.com rollback failed after promotion save error", rollbackError); }
    }
    return fail(result.error.code === "23505" ? "Disable the other active deal for this package first." : "Could not save this promotion.");
  }
  await audit(d.id ? "update" : "create", "promotion", d.id ?? null, { ...row, promo_code: row.promo_code ? "[set]" : null });
  revalidatePath("/admin/services");
  revalidatePath("/booking");
  const baseMessage = d.id ? "Deal updated" : "Deal created";
  return { ok: true, message: needsCalSync ? `${baseMessage} and Cal.com pricing verified` : baseMessage };
}

export async function saveServicePackage(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    package_id: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
    category: z.enum(["content", "music", "brand", "events", "estate", "custom"]),
    name: z.string().trim().min(1).max(100), tagline: z.string().trim().max(240),
    price: z.string().trim().max(20), deposit_percent: z.coerce.number().min(0).max(100),
    duration_minutes: z.coerce.number().int().min(0).max(4320), locations: z.coerce.number().int().min(0).max(100),
    location_label: text(80), revisions: z.coerce.number().int().min(0).max(100),
    delivery: z.string().trim().max(120), includes: z.string().max(4000),
    sort_order: z.coerce.number().int().min(0).max(10000), is_new: z.enum(["yes", "no"]),
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the package name, id, pricing, and production details.");
  const d = input.data;
  const price = parseCents(d.price);
  const inquiryOnly = fd.get("inquiry_only") === "on";
  if (price === null || (!inquiryOnly && price <= 0)) return fail("Enter a package price, or mark it inquiry-only.");
  if (d.is_new === "yes") {
    const staticMatch = bookingPackages.some((pkg) => pkg.id === d.package_id);
    const { data: stored } = await supabase.from("service_packages").select("package_id").eq("package_id", d.package_id).maybeSingle();
    if (staticMatch || stored) return fail("That package ID already exists. Edit the existing package instead.");
  }
  const includes = d.includes.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 30);
  if (!includes.length) return fail("Add at least one included item, one per line.");
  const row = {
    package_id: d.package_id, category: d.category, name: d.name, tagline: d.tagline, price_cents: price,
    deposit_percent: d.deposit_percent, duration_minutes: d.duration_minutes, locations: d.locations,
    location_label: d.location_label, revisions: d.revisions, delivery: d.delivery, includes,
    featured: fd.get("featured") === "on", inquiry_only: inquiryOnly,
    starting_price: fd.get("starting_price") === "on", active: fd.get("active") === "on", sort_order: d.sort_order,
  };
  const mapping = calEvents()[d.package_id];
  const shouldSyncCal = row.active && !row.inquiry_only && !!mapping;

  let calBefore: Awaited<ReturnType<typeof syncCalPackage>> | null = null;
  if (shouldSyncCal) {
    try {
      const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      const { data: livePromotion } = await supabase.from("promotions").select("enabled, original_price_cents, discounted_price_cents, starts_on, ends_on, booking_deadline")
        .eq("package_id", d.package_id).eq("enabled", true).lte("starts_on", today).gte("ends_on", today).maybeSingle();
      const effectivePrice = livePromotion && livePromotion.original_price_cents === price && promotionIsLive(livePromotion, today) ? livePromotion.discounted_price_cents : price;
      calBefore = await syncCatalogPackage({ id: d.package_id, name: d.name, minutes: d.duration_minutes, depositPercent: d.deposit_percent }, effectivePrice);
    } catch (error) {
      console.error("Cal.com package sync failed", error);
      return fail("Cal.com could not confirm the new price. Nothing was changed. Check the event connection and try again.");
    }
  }
  const { error } = await supabase.from("service_packages").upsert(row, { onConflict: "package_id" });
  if (error) {
    if (calBefore) {
      try { await rollbackCalPackage(calBefore); }
      catch (rollbackError) { console.error("Cal.com rollback failed after package save error", rollbackError); }
    }
    return fail("Could not save this package. Make sure the catalog migration has been applied.");
  }
  await audit(d.is_new === "yes" ? "create" : "update", "service_package", d.package_id, row);
  revalidatePath("/admin/services"); revalidatePath("/admin/bookings/new"); revalidatePath("/booking");
  const baseMessage = d.is_new === "yes" ? "Package created" : "Package updated";
  return { ok: true, message: shouldSyncCal ? `${baseMessage} and Cal.com pricing verified` : mapping ? `${baseMessage}; Cal.com sync is paused while this package is unpublished or inquiry-only` : `${baseMessage}; connect a Cal.com event to enable online checkout` };
}

// ── Balance payment links ────────────────────────────────────────────────────
// A single-use Stripe Payment Link for the balance. The payment is recorded by the
// Stripe webhook (metadata.admin_booking_id); nothing here marks anything paid.
export async function createBalancePaymentLink(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ id: uuid, amount: z.string().trim().max(20) }).safeParse(form(fd));
  if (!input.success) return fail("Booking not found.");
  const stripeConfig = adminStripe();
  if (!stripeConfig) return fail("Stripe is not configured (STRIPE_SECRET_KEY).");
  const { data: b } = await supabase.from("booking_ledger").select("id, status, balance_cents, client_email, project_title, package_name, payment_link_id").eq("id", input.data.id).single();
  if (!b) return fail("Booking not found.");
  if (b.status === "canceled") return fail("This booking is canceled.");
  const amount = input.data.amount ? parseCents(input.data.amount) : b.balance_cents;
  if (!amount || amount < 50) return fail("Enter an amount of at least $0.50.");
  if (amount > b.balance_cents) return fail(`That is more than the ${usd(b.balance_cents)} balance.`);
  const { stripe, options } = stripeConfig;
  const project = b.project_title || b.package_name || "Video production";
  try {
    if (b.payment_link_id) await stripe.paymentLinks.update(b.payment_link_id, { active: false }, options).catch(() => null);
    const metadata = { admin_booking_id: b.id, admin_payment_type: amount === b.balance_cents ? "final" : "partial" };
    const link = await stripe.paymentLinks.create({
      line_items: [{ price_data: { currency: "usd", unit_amount: amount, product_data: { name: `${project} — ${amount === b.balance_cents ? "remaining balance" : "payment"}` } }, quantity: 1 }],
      payment_intent_data: { metadata, description: `${project} (${b.id.slice(0, 8)})` },
      metadata,
      restrictions: { completed_sessions: { limit: 1 } },
      inactive_message: "This payment link has already been used or replaced. Please contact the studio for a new one.",
      after_completion: { type: "redirect", redirect: { url: `${bookingSiteUrl()}/booking/paid` } },
    }, options);
    const { error } = await supabase.from("bookings").update({ payment_link_id: link.id, payment_link_url: link.url, payment_link_cents: amount }).eq("id", b.id);
    if (error) return fail("The link was created in Stripe but could not be saved. Try again.");
    await supabase.from("booking_events").insert({ booking_id: b.id, kind: "note", actor: "admin", detail: `Payment link created for ${usd(amount)}` });
  } catch (error) {
    return fail(error instanceof Error ? `Stripe: ${error.message}` : "Stripe did not respond. Try again.");
  }
  revalidatePath(`/admin/bookings/${b.id}`);
  return { ok: true, message: "Payment link ready" };
}

// ── Automation ───────────────────────────────────────────────────────────────
export async function runAutomationNow(): Promise<ActionState> {
  await requireAdmin();
  const db = createSupabaseService();
  if (!db) return fail("The admin database is not configured.");
  try {
    const result = await runDailyAutomation(db);
    await audit("run", "automation", null, result);
    revalidatePath("/admin", "layout");
    const status = typeof result.status === "string" ? "status rules off" : `${result.status.shootCompleted} shoots completed, ${result.status.editing} to editing, ${result.status.archived} archived`;
    const mail = typeof result.reminders === "string" ? "client emails off" : `${result.reminders.shoot + result.reminders.dueSoon + result.reminders.overdue} reminders sent${result.reminders.failed ? `, ${result.reminders.failed} failed` : ""}`;
    return { ok: true, message: `Done: ${status}; ${mail}.` };
  } catch {
    return fail("Automation failed. Try again, or check the server logs.");
  }
}

export async function syncExistingBookings(): Promise<ActionState> {
  await requireAdmin();
  try {
    const result = await syncExistingBookingsToAdmin();
    await audit("sync", "website_bookings", null, result);
    revalidatePath("/admin", "layout");
    return {
      ok: true,
      message: `Synced ${result.synced} of ${result.found} stored bookings${result.skipped ? `; ${result.skipped} superseded record${result.skipped === 1 ? "" : "s"} skipped` : ""}.`,
    };
  } catch (error) {
    console.error("Booking sync failed", error);
    return fail("Booking sync failed. Check the server logs and try again.");
  }
}
