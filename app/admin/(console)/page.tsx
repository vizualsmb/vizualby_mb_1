import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import { Card, Kpi, Notice, PageHeader } from "@/components/admin/ui";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { RevenueChart } from "@/components/admin/RevenueChart";
import { PaymentsDue, UpcomingShoots } from "@/components/admin/bookings";
import { requireAdmin } from "@/lib/admin/auth";
import { dashboardData } from "@/lib/admin/queries";
import { resolveRange } from "@/lib/admin/finance";
import { chartPoints } from "@/lib/admin/chart";
import { BOOKING_STATUSES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import { nyDay } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Dashboard" };

const monthName = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "long" });

function change(now: number, before: number) {
  if (!before) return null;
  const pct = Math.round(((now - before) / Math.abs(before)) * 100);
  return <><b>{pct >= 0 ? "+" : ""}{pct}%</b> vs last month</>;
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const range = resolveRange(params.range, nyDay(new Date()), params);
  const d = await dashboardData(supabase, range);
  const month = monthName.format(new Date());

  return <>
    <PageHeader eyebrow={`${month} · at a glance`} title="Studio overview">
      <Link href="/admin/bookings/new" className={s.button}><Plus size={16} aria-hidden />New booking</Link>
    </PageHeader>

    {d.overdueCount > 0 && <Notice>
      <span><b>{d.overdueCount} {d.overdueCount === 1 ? "balance is" : "balances are"} past due.</b> <Link href="/admin/bookings?filter=unpaid" className={s.cardLink}>Review payments due →</Link></span>
    </Notice>}

    <div className={s.kpis}>
      <Kpi label="Revenue this month" value={usd(d.month.collected)} hint={change(d.month.collected, d.lastMonth.collected) ?? "Money collected, net of refunds"} href="/admin/finances" />
      <Kpi label="Deposits collected" value={usd(d.month.deposits)} hint={`In ${month}`} href="/admin/payments" />
      <Kpi label="Outstanding balance" value={usd(d.outstanding)} hint={d.overdueCount ? <><b>{d.overdueCount}</b> overdue</> : "Owed on confirmed bookings"} href="/admin/bookings?filter=unpaid" />
      <Kpi label="Upcoming shoots" value={String(d.upcomingCount30)} hint="Next 30 days" href="/admin/bookings?filter=upcoming" />
      <Kpi label="Average booking value" value={usd(d.averageBookingValue)} hint="Confirmed bookings this year" href="/admin/analytics" />
      <Kpi label="Net profit this month" value={usd(d.month.profit)} negative={d.month.profit < 0} hint={<>Revenue − <b>{usd(d.month.expenses)}</b> expenses</>} href="/admin/expenses" />
    </div>
    <p className={s.kpisSecondary}>
      <span>Revenue this year<b>{usd(d.year.collected)}</b></span>
      <span>Bookings this year<b>{d.bookingsThisYear}</b></span>
      <span>Awaiting deposit<b>{d.pendingDeposits}</b></span>
      <span>Completed this year<b>{d.completedThisYear}</b></span>
    </p>

    <div className={s.section}>
      <Card title="Revenue, expenses & profit" action={<span className={s.metaText}>{range.label}</span>}>
        <RangeFilter base="/admin" range={range} params={params} />
        <p className={s.kpisSecondary} style={{ marginTop: 0, paddingTop: 0, marginBottom: 12 }}>
          <span>Revenue<b>{usd(d.range.collected)}</b></span>
          <span>Expenses<b>{usd(d.range.expenses)}</b></span>
          <span>Profit<b style={d.range.profit < 0 ? { color: "var(--bad)" } : undefined}>{usd(d.range.profit)}</b></span>
          {d.range.refunds > 0 && <span>Refunded<b>{usd(d.range.refunds)}</b></span>}
        </p>
        <RevenueChart points={chartPoints(d.series, range.bucket)} />
      </Card>
    </div>

    <div className={`${s.grid2} ${s.section}`}>
      <Card title="Next shoots" action={<Link className={s.cardLink} href="/admin/bookings?filter=upcoming">All upcoming →</Link>}><UpcomingShoots rows={d.upcoming} /></Card>
      <Card title="Payments due" action={<Link className={s.cardLink} href="/admin/bookings?filter=unpaid">All balances →</Link>}><PaymentsDue rows={d.paymentsDue} /></Card>
    </div>

    <div className={s.section}>
      <Card title="Pipeline">
        <nav className={s.chips} aria-label="Bookings by status" style={{ flexWrap: "wrap" }}>
          {BOOKING_STATUSES.filter(([id]) => id !== "archived" && d.pipeline[id]).map(([id, label]) =>
            <Link key={id} className={s.chip} href={`/admin/bookings?status=${id}`}>{label}<b style={{ marginLeft: 8 }}>{d.pipeline[id]}</b></Link>)}
          {!Object.keys(d.pipeline).length && <span className={s.metaText}>No active bookings yet.</span>}
        </nav>
      </Card>
    </div>
  </>;
}
