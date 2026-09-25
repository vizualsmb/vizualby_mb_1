"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { bookingPackages } from "@/data/booking";
import { requireAdmin } from "./auth";
import { parseCents } from "./money";
import { nyInstant } from "./time";
import { BOOKING_STATUSES, CLIENT_TYPES, EXPENSE_CATEGORIES, LEAD_SOURCES, PAYMENT_METHODS, PAYMENT_TYPES, keysOf } from "./labels";

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

// ── Bookings ─────────────────────────────────────────────────────────────────
export async function updateBookingStatus(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({ id: uuid, status: z.enum(BOOKING_STATUSES.map(([s]) => s) as [string, ...string[]]) }).safeParse(form(fd));
  if (!input.success) return fail("Choose a valid status.");
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
  const pkg = bookingPackages.find((p) => p.id === d.package_id);
  const price = d.price ? parseCents(d.price) : pkg?.price ?? null;
  const deposit = d.deposit ? parseCents(d.deposit) : pkg?.deposit ?? 0;
  if (price === null || deposit === null) return fail("Enter the agreed price, e.g. 750.");

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

// ── Expenses ─────────────────────────────────────────────────────────────────
export async function addExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const input = z.object({
    name: z.string().trim().min(1).max(160), amount: z.string().max(20), spent_on: day, category: enumOf(EXPENSE_CATEGORIES),
    vendor: text(120), booking_id: optional(uuid), payment_method: optional(enumOf(PAYMENT_METHODS)), notes: text(1000),
  }).safeParse(form(fd));
  if (!input.success) return fail("Name, amount, date and category are required.");
  const amount = parseCents(input.data.amount);
  if (!amount) return fail("Enter an amount, e.g. 45.99.");
  const { name, spent_on, category, vendor, booking_id, payment_method, notes } = input.data;
  const { error } = await supabase.from("expenses").insert({ name, spent_on, category, vendor, notes, amount_cents: amount, booking_id: booking_id ?? null, payment_method: payment_method ?? null });
  if (error) return fail("Could not save the expense.");
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Expense added" };
}

export async function deleteExpense(_: ActionState, fd: FormData): Promise<ActionState> {
  const { supabase } = await requireAdmin();
  const id = uuid.safeParse(fd.get("id"));
  if (!id.success) return fail("Expense not found.");
  const { data: removed, error } = await supabase.from("expenses").delete().eq("id", id.data).select("name, amount_cents, spent_on").maybeSingle();
  if (error) return fail("Could not delete the expense.");
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
  }).safeParse(form(fd));
  if (!input.success) return fail("Check the settings values.");
  const { error } = await supabase.from("business_settings").update({ ...input.data, email: input.data.email ?? null }).eq("id", true);
  if (error) return fail("Could not save settings.");
  await audit("update", "business_settings", null, input.data);
  revalidatePath("/admin/settings");
  return { ok: true, message: "Settings saved" };
}
