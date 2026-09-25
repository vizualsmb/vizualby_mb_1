import { test } from "node:test";
import assert from "node:assert/strict";
import { averageBookingValue, buildSeries, collectedCents, outstandingCents, resolveRange, summarize } from "../lib/admin/finance";
import { nyDay, startOfNyDay } from "../lib/admin/time";

const pay = (amount_cents: number, status: string, paid_at: string, extra: Partial<{ refunded_cents: number; type: string }> = {}) =>
  ({ amount_cents, status, paid_at, refunded_cents: 0, type: "deposit", ...extra });

test("failed and pending payments are never revenue; refunds reduce it", () => {
  assert.equal(collectedCents(pay(40000, "failed", "2026-09-01T15:00:00Z")), 0);
  assert.equal(collectedCents(pay(40000, "pending", "2026-09-01T15:00:00Z")), 0);
  assert.equal(collectedCents(pay(40000, "partially_refunded", "2026-09-01T15:00:00Z", { refunded_cents: 15000 })), 25000);
  assert.equal(collectedCents(pay(40000, "refunded", "2026-09-01T15:00:00Z", { refunded_cents: 40000 })), 0);
});

test("profit is collected revenue minus expenses, and deposits are split out", () => {
  const s = summarize(
    [pay(40000, "succeeded", "2026-09-02T15:00:00Z"), pay(40000, "succeeded", "2026-09-20T15:00:00Z", { type: "final" }), pay(9999, "failed", "2026-09-03T15:00:00Z")],
    [{ amount_cents: 12000, spent_on: "2026-09-05" }, { amount_cents: 5000, spent_on: "2026-08-31" }],
    { from: "2026-09-01", to: "2026-09-30" },
  );
  assert.deepEqual([s.collected, s.deposits, s.expenses, s.profit], [80000, 40000, 12000, 68000]);
});

test("a late-evening New York payment lands on the New York day, not the UTC day", () => {
  // 11:30 PM Sep 30 in New York is Oct 1 in UTC.
  assert.equal(nyDay("2026-10-01T03:30:00Z"), "2026-09-30");
  const s = summarize([pay(10000, "succeeded", "2026-10-01T03:30:00Z")], [], { from: "2026-09-01", to: "2026-09-30" });
  assert.equal(s.collected, 10000);
  assert.equal(startOfNyDay("2026-11-02").toISOString(), "2026-11-02T05:00:00.000Z"); // after DST ends
  assert.equal(startOfNyDay("2026-10-30").toISOString(), "2026-10-30T04:00:00.000Z");
});

test("uncommitted and canceled bookings are excluded from outstanding and average value", () => {
  const rows = [
    { status: "confirmed", total_cents: 80000, balance_cents: 40000 },
    { status: "delivered", total_cents: 50000, balance_cents: 0 },
    { status: "new_inquiry", total_cents: 150000, balance_cents: 150000 },
    { status: "canceled", total_cents: 90000, balance_cents: 0 },
  ];
  assert.equal(outstandingCents(rows), 40000);
  assert.equal(averageBookingValue(rows), 65000);
});

test("ranges bucket sensibly and series totals match the summary", () => {
  const r = resolveRange("6m", "2026-09-24");
  assert.deepEqual([r.from, r.to, r.bucket], ["2026-04-01", "2026-09-24", "month"]);
  const payments = [pay(10000, "succeeded", "2026-04-02T15:00:00Z"), pay(20000, "succeeded", "2026-09-24T15:00:00Z")];
  const series = buildSeries(payments, [{ amount_cents: 3000, spent_on: "2026-09-01" }], r);
  assert.equal(series.length, 6);
  assert.deepEqual([series[0].revenue, series[5].revenue, series[5].profit], [10000, 20000, 17000]);
  assert.equal(resolveRange("custom", "2026-09-24", { from: "2026-09-10", to: "2026-09-01" }).key, "6m"); // invalid → default
  assert.equal(resolveRange("custom", "2026-09-24", { from: "2026-09-01", to: "2026-09-10" }).bucket, "day");
});
