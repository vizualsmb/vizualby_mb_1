import type { Metadata } from "next";
import s from "@/components/admin/admin.module.css";
import { Card, Kpi, PageHeader } from "@/components/admin/ui";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { Breakdown } from "@/components/admin/Breakdown";
import { requireAdmin } from "@/lib/admin/auth";
import { collectedPayments, expensesSince, listExpenses } from "@/lib/admin/queries";
import { averageBookingValue, buildSeries, isCommitted, outstandingCents, resolveRange, summarize, type BookingValueRow } from "@/lib/admin/finance";
import { chartPoints } from "@/lib/admin/chart";
import { EXPENSE_CATEGORIES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import { nyDay, startOfNyDay, addDays } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Finances" };

export default async function FinancesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const range = resolveRange(params.range, nyDay(new Date()), params);
  const [payments, expenses, expenseRows, booked, open] = await Promise.all([
    collectedPayments(supabase, range.from),
    expensesSince(supabase, range.from),
    listExpenses(supabase, range),
    supabase.from("booking_ledger").select("status, total_cents, balance_cents")
      .gte("created_at", startOfNyDay(range.from).toISOString()).lt("created_at", startOfNyDay(addDays(range.to, 1)).toISOString()),
    supabase.from("booking_ledger").select("status, total_cents, balance_cents").gt("balance_cents", 0),
  ]);
  if (booked.error || open.error) throw new Error("Could not load bookings");
  const sum = summarize(payments, expenses, range);
  const bookedRows = (booked.data ?? []) as BookingValueRow[];
  const grossBooked = bookedRows.filter(isCommitted).reduce((t, b) => t + b.total_cents, 0);
  const margin = sum.collected ? Math.round((sum.profit / sum.collected) * 100) : null;
  const byCategory = Object.entries(expenseRows.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount_cents }), {}))
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES] ?? k, value: v }));

  return <>
    <PageHeader eyebrow="Revenue is not profit" title="Finances" subtitle="Revenue is money you actually collected. Profit is that revenue minus expenses. Booked value is work clients have committed to, not money in the bank." />
    <RangeFilter base="/admin/finances" range={range} params={params} />
    <div className={s.kpis}>
      <Kpi label="Booked value" value={usd(grossBooked)} hint="Committed bookings made in this range" />
      <Kpi label="Revenue collected" value={usd(sum.collected)} hint="Payments received, net of refunds" />
      <Kpi label="Outstanding" value={usd(outstandingCents((open.data ?? []) as BookingValueRow[]))} hint="Still owed today, all bookings" />
      <Kpi label="Refunds" value={usd(sum.refunds)} hint="Already subtracted from revenue" />
      <Kpi label="Expenses" value={usd(sum.expenses)} />
      <Kpi label="Net profit" value={usd(sum.profit)} negative={sum.profit < 0} hint={margin !== null ? <><b>{margin}%</b> margin</> : "Revenue − expenses"} />
      <Kpi label="Average booking value" value={usd(averageBookingValue(bookedRows))} hint="Committed bookings in range" />
    </div>
    <div className={s.section}>
      <Card title="Revenue, expenses & profit" action={<span className={s.metaText}>{range.label}</span>}>
        <RevenueChart points={chartPoints(buildSeries(payments, expenses, range), range.bucket)} />
      </Card>
    </div>
    <div className={`${s.grid2} ${s.section}`}>
      <Card title="Where the money went"><Breakdown rows={byCategory} format={usd} empty="No expenses in this range" /></Card>
      <Card title="How the numbers are calculated">
        <dl className={s.moneyRows} style={{ fontSize: 13 }}>
          <div><dt className={s.cardTitle}>Revenue collected</dt><dd className={s.metaText} style={{ margin: "2px 0 10px" }}>Successful payments minus refunds, by payment date (New York time). Failed and pending payments never count.</dd></div>
          <div><dt className={s.cardTitle}>Outstanding</dt><dd className={s.metaText} style={{ margin: "2px 0 10px" }}>Booking total minus money collected, for bookings with a paid deposit or later. Inquiries, unpaid holds and canceled bookings are excluded.</dd></div>
          <div><dt className={s.cardTitle}>Net profit</dt><dd className={s.metaText} style={{ margin: "2px 0 10px" }}>Revenue collected minus recorded expenses in the same period.</dd></div>
          <div><dt className={s.cardTitle}>Canceled bookings</dt><dd className={s.metaText} style={{ margin: "2px 0 0" }}>A kept deposit stays in revenue; a refunded one is removed. Nothing further is owed.</dd></div>
        </dl>
      </Card>
    </div>
  </>;
}
