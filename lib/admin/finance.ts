import { addDays, addMonths, monthStart, nyDay, yearStart } from "./time";

// Financial rules for the whole admin. Everything is integer cents.
// Revenue = money actually collected (net of refunds). Profit = revenue − expenses.
// Booked value is what clients agreed to pay; it is never shown as revenue.

export type PaymentRow = { amount_cents: number; refunded_cents: number; status: string; type: string; paid_at: string | null };
export type ExpenseRow = { amount_cents: number; spent_on: string };
export type BookingValueRow = { status: string; total_cents: number; balance_cents: number };

const COLLECTED_STATUSES = new Set(["succeeded", "partially_refunded", "refunded"]);
// Inquiries and unpaid holds are not commitments yet, so they are left out of
// outstanding balances and average booking value. Canceled bookings owe nothing.
const UNCOMMITTED = new Set(["new_inquiry", "deposit_pending", "canceled"]);

export const collectedCents = (p: PaymentRow) => (COLLECTED_STATUSES.has(p.status) ? p.amount_cents - p.refunded_cents : 0);
export const isCommitted = (b: { status: string }) => !UNCOMMITTED.has(b.status);

export const outstandingCents = (rows: BookingValueRow[]) =>
  rows.filter(isCommitted).reduce((sum, b) => sum + b.balance_cents, 0);

export function averageBookingValue(rows: BookingValueRow[]) {
  const valid = rows.filter(isCommitted);
  return valid.length ? Math.round(valid.reduce((s, b) => s + b.total_cents, 0) / valid.length) : 0;
}

// ── Date ranges ──────────────────────────────────────────────────────────────
export const RANGE_PRESETS = [
  ["7d", "7 days"], ["30d", "30 days"], ["3m", "3 months"], ["6m", "6 months"], ["12m", "12 months"], ["ytd", "Year to date"],
] as const;
export type RangeKey = (typeof RANGE_PRESETS)[number][0] | "custom";
export type Bucket = "day" | "week" | "month";
export type DateRange = { key: RangeKey; from: string; to: string; bucket: Bucket; label: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const daysBetween = (a: string, b: string) => Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);

export function resolveRange(key: string | undefined, today: string, custom?: { from?: string; to?: string }): DateRange {
  const preset = RANGE_PRESETS.find(([k]) => k === key);
  if (key === "custom" && custom?.from && custom.to && DAY.test(custom.from) && DAY.test(custom.to) && custom.from <= custom.to && daysBetween(custom.from, custom.to) <= 3 * 366) {
    const span = daysBetween(custom.from, custom.to);
    return { key: "custom", from: custom.from, to: custom.to, bucket: span <= 14 ? "day" : span <= 120 ? "week" : "month", label: "Custom range" };
  }
  const k = preset?.[0] ?? "6m";
  const label = RANGE_PRESETS.find(([id]) => id === k)![1];
  switch (k) {
    case "7d": return { key: k, from: addDays(today, -6), to: today, bucket: "day", label };
    case "30d": return { key: k, from: addDays(today, -29), to: today, bucket: "week", label };
    case "3m": return { key: k, from: addDays(today, -90), to: today, bucket: "week", label };
    case "12m": return { key: k, from: addMonths(monthStart(today), -11), to: today, bucket: "month", label };
    case "ytd": return { key: k, from: yearStart(today), to: today, bucket: "month", label };
    default: return { key: "6m", from: addMonths(monthStart(today), -5), to: today, bucket: "month", label: "6 months" };
  }
}

export const inRange = (day: string, r: { from: string; to: string }) => day >= r.from && day <= r.to;

// ── Series ───────────────────────────────────────────────────────────────────
export type SeriesPoint = { key: string; from: string; revenue: number; expenses: number; profit: number };

function bucketStarts(r: DateRange) {
  const starts: string[] = [];
  if (r.bucket === "month") for (let d = monthStart(r.from); d <= r.to; d = addMonths(d, 1)) starts.push(d);
  else for (let d = r.from; d <= r.to; d = addDays(d, r.bucket === "week" ? 7 : 1)) starts.push(d);
  return starts;
}
function bucketIndex(day: string, r: DateRange, starts: string[]) {
  if (r.bucket === "month") return starts.indexOf(monthStart(day));
  return Math.floor(daysBetween(r.from, day) / (r.bucket === "week" ? 7 : 1));
}

export function buildSeries(payments: PaymentRow[], expenses: ExpenseRow[], r: DateRange): SeriesPoint[] {
  const starts = bucketStarts(r);
  const points = starts.map((from) => ({ key: from, from, revenue: 0, expenses: 0, profit: 0 }));
  for (const p of payments) {
    if (!p.paid_at) continue;
    const day = nyDay(p.paid_at);
    if (inRange(day, r)) { const i = bucketIndex(day, r, starts); if (points[i]) points[i].revenue += collectedCents(p); }
  }
  for (const e of expenses) {
    if (inRange(e.spent_on, r)) { const i = bucketIndex(e.spent_on, r, starts); if (points[i]) points[i].expenses += e.amount_cents; }
  }
  for (const p of points) p.profit = p.revenue - p.expenses;
  return points;
}

export function summarize(payments: PaymentRow[], expenses: ExpenseRow[], r: { from: string; to: string }) {
  let collected = 0, deposits = 0, refunds = 0, pending = 0;
  for (const p of payments) {
    if (!p.paid_at || !inRange(nyDay(p.paid_at), r)) continue;
    collected += collectedCents(p);
    if (p.type === "deposit") deposits += collectedCents(p);
    if (COLLECTED_STATUSES.has(p.status)) refunds += p.refunded_cents;
    if (p.status === "pending") pending += p.amount_cents;
  }
  const spent = expenses.filter((e) => inRange(e.spent_on, r)).reduce((s, e) => s + e.amount_cents, 0);
  return { collected, deposits, refunds, pending, expenses: spent, profit: collected - spent };
}
