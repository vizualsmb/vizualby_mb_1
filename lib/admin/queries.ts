import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, addMonths, monthStart, nyDay, startOfNyDay, yearStart } from "./time";
import { averageBookingValue, buildSeries, isCommitted, outstandingCents, summarize, type DateRange, type ExpenseRow, type PaymentRow } from "./finance";
import { BOOKING_STATUSES, type BookingStatus, type PaymentState } from "./labels";

export const PAGE_SIZE = 25;

export type LedgerRow = {
  id: string; reference: string | null; client_id: string; client_name: string; client_email: string | null; client_phone: string | null; client_company: string | null;
  status: BookingStatus; payment_state: PaymentState; source: string; package_id: string | null; package_name: string | null; service_category: string | null;
  project_title: string | null; project_description: string | null; client_message: string | null; location: string | null;
  shoot_start: string | null; shoot_end: string | null; total_cents: number; package_price_cents: number; addons_cents: number; adjustment_cents: number;
  deposit_required_cents: number; paid_cents: number; refunded_cents: number; balance_cents: number; due_date: string | null; balance_due_date: string | null;
  lead_source: string | null; lead_source_detail: string | null; notes: string | null; created_at: string; updated_at: string;
  payment_link_url?: string | null; payment_link_cents?: number | null;
};
export type Payment = PaymentRow & { id: string; booking_id: string; method: string; stripe_payment_intent_id: string | null; notes: string | null; created_at: string };
export type Expense = ExpenseRow & { id: string; name: string; category: string; vendor: string | null; booking_id: string | null; payment_method: string | null; notes: string | null; receipt_path: string | null };
export type ClientSummary = {
  id: string; name: string; email: string | null; phone: string | null; company: string | null; social: string | null; client_type: string; notes: string | null; created_at: string;
  booking_count: number; first_booking_at: string | null; last_booking_at: string | null; lifetime_revenue_cents: number; booked_value_cents: number; outstanding_cents: number; next_shoot_at: string | null;
};

const LIST_COLUMNS = "id, reference, client_id, client_name, client_email, status, payment_state, source, package_name, service_category, project_title, location, shoot_start, shoot_end, total_cents, deposit_required_cents, paid_cents, balance_cents, due_date, lead_source, created_at";

// PostgREST filter strings must not receive raw user input: keep only safe characters.
export const cleanSearch = (q?: string) => (q || "").replace(/[^\p{L}\p{N}\s@.+_-]/gu, " ").trim().slice(0, 60);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function must<T>(result: { data: T | null; error: { message: string } | null }) {
  if (result.error) throw new Error(result.error.message);
  return result.data as T;
}

export async function collectedPayments(db: SupabaseClient, fromDay: string) {
  return must(await db.from("payments").select("amount_cents, refunded_cents, status, type, paid_at")
    .gte("paid_at", startOfNyDay(fromDay).toISOString()).order("paid_at")) as PaymentRow[];
}
export async function expensesSince(db: SupabaseClient, fromDay: string) {
  return must(await db.from("expenses").select("amount_cents, spent_on").gte("spent_on", fromDay)) as ExpenseRow[];
}

// ── Dashboard ────────────────────────────────────────────────────────────────
export async function dashboardData(db: SupabaseClient, range: DateRange) {
  const today = nyDay(new Date());
  const earliest = [range.from, addMonths(monthStart(today), -1), yearStart(today)].sort()[0];
  const [payments, expenses, ledger] = await Promise.all([
    collectedPayments(db, earliest),
    expensesSince(db, earliest),
    db.from("booking_ledger").select(LIST_COLUMNS).neq("status", "archived").limit(2000).then(must) as Promise<LedgerRow[]>,
  ]);
  const thisMonth = { from: monthStart(today), to: today };
  const lastMonth = { from: addMonths(monthStart(today), -1), to: addDays(monthStart(today), -1) };
  const now = Date.now();
  const upcoming = ledger.filter((b) => b.shoot_start && Date.parse(b.shoot_start) >= now && b.status !== "canceled")
    .sort((a, b) => a.shoot_start!.localeCompare(b.shoot_start!));
  const due = ledger.filter((b) => isCommitted(b) && b.balance_cents > 0)
    .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
  const yearRows = ledger.filter((b) => b.created_at >= startOfNyDay(yearStart(today)).toISOString());
  return {
    month: summarize(payments, expenses, thisMonth),
    lastMonth: summarize(payments, expenses, lastMonth),
    year: summarize(payments, expenses, { from: yearStart(today), to: today }),
    range: summarize(payments, expenses, range),
    series: buildSeries(payments, expenses, range),
    outstanding: outstandingCents(ledger),
    overdueCount: due.filter((b) => b.payment_state === "overdue").length,
    averageBookingValue: averageBookingValue(yearRows.length ? yearRows : ledger),
    upcoming: upcoming.slice(0, 5),
    upcomingCount30: upcoming.filter((b) => Date.parse(b.shoot_start!) <= now + 30 * 86400000).length,
    paymentsDue: due.slice(0, 6),
    bookingsThisYear: yearRows.filter((b) => b.status !== "canceled").length,
    pendingDeposits: ledger.filter((b) => b.status === "deposit_pending").length,
    completedThisYear: yearRows.filter((b) => ["delivered", "paid"].includes(b.status)).length,
    pipeline: ledger.reduce<Record<string, number>>((acc, b) => ({ ...acc, [b.status]: (acc[b.status] ?? 0) + 1 }), {}),
  };
}

// ── Bookings ─────────────────────────────────────────────────────────────────
export const BOOKING_FILTERS = [
  ["all", "All"], ["upcoming", "Upcoming"], ["week", "This week"], ["month", "This month"], ["unpaid", "Balance due"],
  ["paid", "Paid"], ["deposit_pending", "Deposit pending"], ["editing", "In post"], ["delivered", "Delivered"], ["canceled", "Canceled"], ["archived", "Archived"],
] as const;

export async function listBookings(db: SupabaseClient, { filter = "all", status, q, page = 1 }: { filter?: string; status?: string; q?: string; page?: number }) {
  const today = nyDay(new Date());
  let query = db.from("booking_ledger").select(LIST_COLUMNS, { count: "exact" });
  const nowIso = new Date().toISOString();
  switch (filter) {
    case "upcoming": query = query.gte("shoot_start", nowIso).neq("status", "canceled").order("shoot_start"); break;
    case "week": query = query.gte("shoot_start", startOfNyDay(today).toISOString()).lt("shoot_start", startOfNyDay(addDays(today, 7)).toISOString()).neq("status", "canceled").order("shoot_start"); break;
    case "month": query = query.gte("shoot_start", startOfNyDay(monthStart(today)).toISOString()).lt("shoot_start", startOfNyDay(addMonths(today, 1)).toISOString()).neq("status", "canceled").order("shoot_start"); break;
    case "unpaid": query = query.gt("balance_cents", 0).not("status", "in", "(new_inquiry,deposit_pending,canceled)").order("due_date"); break;
    case "paid": query = query.eq("payment_state", "paid"); break;
    case "editing": query = query.in("status", ["editing", "client_review", "revision"]); break;
    case "deposit_pending": case "delivered": case "canceled": case "archived": query = query.eq("status", filter); break;
    default: query = query.neq("status", "archived");
  }
  if (status && BOOKING_STATUSES.some(([id]) => id === status)) query = query.eq("status", status);
  const term = cleanSearch(q);
  if (term) {
    query = UUID.test(term) ? query.eq("id", term)
      : query.or(["client_name", "client_email", "client_phone", "project_title", "package_name", "reference"].map((c) => `${c}.ilike.%${term}%`).join(","));
  }
  if (!["upcoming", "week", "month", "unpaid"].includes(filter)) query = query.order("shoot_start", { ascending: false, nullsFirst: true });
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as unknown as LedgerRow[], total: count ?? 0 };
}

export async function bookingDetail(db: SupabaseClient, id: string) {
  if (!UUID.test(id)) return null;
  const [booking, addons, payments, events, expenses] = await Promise.all([
    db.from("booking_ledger").select("*").eq("id", id).maybeSingle().then(must),
    db.from("booking_addons").select("addon_id, name, price_cents").eq("booking_id", id).then(must),
    db.from("payments").select("*").eq("booking_id", id).order("paid_at", { ascending: false }).then(must),
    db.from("booking_events").select("*").eq("booking_id", id).order("occurred_at", { ascending: false }).limit(100).then(must),
    db.from("expenses").select("id, name, amount_cents, spent_on, category").eq("booking_id", id).order("spent_on").then(must),
  ]);
  if (!booking) return null;
  return {
    booking: booking as LedgerRow,
    addons: addons as { addon_id: string; name: string; price_cents: number }[],
    payments: payments as Payment[],
    events: events as { id: number; kind: string; from_status: string | null; to_status: string | null; detail: string | null; actor: string; occurred_at: string }[],
    expenses: expenses as Pick<Expense, "id" | "name" | "amount_cents" | "spent_on" | "category">[],
  };
}

// ── Clients ──────────────────────────────────────────────────────────────────
export async function listClients(db: SupabaseClient, { q, page = 1, sort = "recent" }: { q?: string; page?: number; sort?: string }) {
  let query = db.from("client_summary").select("*", { count: "exact" });
  const term = cleanSearch(q);
  if (term) query = query.or(["name", "email", "phone", "company", "social"].map((c) => `${c}.ilike.%${term}%`).join(","));
  query = sort === "revenue" ? query.order("lifetime_revenue_cents", { ascending: false }) : query.order("last_booking_at", { ascending: false, nullsFirst: false });
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  return { rows: (data ?? []) as ClientSummary[], total: count ?? 0 };
}

export async function clientDetail(db: SupabaseClient, id: string) {
  if (!UUID.test(id)) return null;
  const [client, bookings] = await Promise.all([
    db.from("client_summary").select("*").eq("id", id).maybeSingle().then(must),
    db.from("booking_ledger").select(LIST_COLUMNS).eq("client_id", id).order("shoot_start", { ascending: false, nullsFirst: true }).then(must),
  ]);
  if (!client) return null;
  const rows = bookings as unknown as LedgerRow[];
  const payments = rows.length ? must(await db.from("payments").select("*").in("booking_id", rows.map((b) => b.id)).order("paid_at", { ascending: false })) as Payment[] : [];
  const now = Date.now();
  const active = rows.filter((b) => b.shoot_start && b.status !== "canceled");
  const last = active.find((b) => Date.parse(b.shoot_start!) < now) ?? null;
  const next = [...active].reverse().find((b) => Date.parse(b.shoot_start!) >= now) ?? null;
  return { client: client as ClientSummary, bookings: rows, payments, last, next };
}

// ── Payments & expenses ──────────────────────────────────────────────────────
export async function listPayments(db: SupabaseClient, { status, page = 1 }: { status?: string; page?: number }) {
  let query = db.from("payments").select("*, bookings!inner(id, project_title, package_name, clients!inner(name))", { count: "exact" });
  if (status && ["pending", "succeeded", "failed", "refunded", "partially_refunded"].includes(status)) query = query.eq("status", status);
  const from = (Math.max(1, page) - 1) * PAGE_SIZE;
  const { data, count, error } = await query.order("paid_at", { ascending: false, nullsFirst: true }).range(from, from + PAGE_SIZE - 1);
  if (error) throw new Error(error.message);
  type Row = Payment & { bookings: { id: string; project_title: string | null; package_name: string | null; clients: { name: string } } };
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}

export async function listExpenses(db: SupabaseClient, range: { from: string; to: string }, category?: string) {
  let query = db.from("expenses").select("*").gte("spent_on", range.from).lte("spent_on", range.to);
  if (category) query = query.eq("category", category);
  return must(await query.order("spent_on", { ascending: false }).limit(500)) as Expense[];
}

export async function bookingOptions(db: SupabaseClient) {
  const rows = must(await db.from("booking_ledger").select("id, client_name, project_title, package_name, shoot_start").neq("status", "archived").order("shoot_start", { ascending: false, nullsFirst: true }).limit(200)) as Pick<LedgerRow, "id" | "client_name" | "project_title" | "package_name" | "shoot_start">[];
  return rows;
}

// ── Analytics ────────────────────────────────────────────────────────────────
type Group = { key: string; bookings: number; booked: number; collected: number };
function groupBy(rows: LedgerRow[], keyOf: (b: LedgerRow) => string) {
  const map = new Map<string, Group>();
  for (const b of rows) {
    const key = keyOf(b);
    const g = map.get(key) ?? { key, bookings: 0, booked: 0, collected: 0 };
    g.bookings += 1; g.booked += b.total_cents; g.collected += b.paid_cents;
    map.set(key, g);
  }
  return [...map.values()].sort((a, b) => b.collected - a.collected || b.bookings - a.bookings);
}

export async function analyticsData(db: SupabaseClient, sinceDay: string) {
  const since = startOfNyDay(sinceDay).toISOString();
  const [ledger, costs] = await Promise.all([
    db.from("booking_ledger").select(`${LIST_COLUMNS}, package_id, lead_source_detail`).gte("created_at", since).limit(5000).then(must) as Promise<LedgerRow[]>,
    db.from("expenses").select("booking_id, amount_cents").not("booking_id", "is", null).gte("spent_on", sinceDay).then(must) as Promise<{ booking_id: string; amount_cents: number }[]>,
  ]);
  const committed = ledger.filter(isCommitted);
  const costByBooking = new Map<string, number>();
  for (const c of costs) costByBooking.set(c.booking_id, (costByBooking.get(c.booking_id) ?? 0) + c.amount_cents);

  const byService = groupBy(committed, (b) => b.service_category ?? "custom").map((g) => ({
    ...g, profit: g.collected - committed.filter((b) => (b.service_category ?? "custom") === g.key).reduce((s, b) => s + (costByBooking.get(b.id) ?? 0), 0),
  }));
  const clientCounts = new Map<string, number>();
  for (const b of committed) clientCounts.set(b.client_id, (clientCounts.get(b.client_id) ?? 0) + 1);
  const clients = clientCounts.size;
  const repeat = [...clientCounts.values()].filter((n) => n > 1).length;
  const leadTimes = committed.filter((b) => b.shoot_start).map((b) => (Date.parse(b.shoot_start!) - Date.parse(b.created_at)) / 86400000).filter((d) => d >= 0);
  const withBalance = committed.filter((b) => b.balance_cents > 0);

  return {
    total: ledger.length,
    committed: committed.length,
    conversion: ledger.length ? committed.length / ledger.length : 0,
    repeatRate: clients ? repeat / clients : 0,
    clients,
    avgLeadDays: leadTimes.length ? Math.round(leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length) : null,
    avgOutstanding: withBalance.length ? Math.round(withBalance.reduce((s, b) => s + b.balance_cents, 0) / withBalance.length) : 0,
    averageBookingValue: averageBookingValue(ledger),
    byPackage: groupBy(committed, (b) => b.package_name ?? "Custom"),
    byService,
    bySource: groupBy(committed, (b) => b.lead_source ?? "unknown"),
    topClients: groupBy(committed, (b) => `${b.client_id}|${b.client_name}`).slice(0, 8),
    byMonth: groupBy(committed, (b) => nyDay(b.created_at).slice(0, 7)).sort((a, b) => a.key.localeCompare(b.key)),
  };
}
