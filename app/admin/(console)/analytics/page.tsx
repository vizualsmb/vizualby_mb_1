import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Card, Chips, Kpi, PageHeader } from "@/components/admin/ui";
import { Breakdown } from "@/components/admin/Breakdown";
import { requireAdmin } from "@/lib/admin/auth";
import { analyticsData } from "@/lib/admin/queries";
import { LEAD_SOURCES, SERVICE_CATEGORIES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import { addMonths, monthStart, nyDay, yearStart } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Analytics" };
const PERIODS = [["12m", "Last 12 months"], ["ytd", "Year to date"], ["all", "All time"]] as const;
const pct = (n: number) => `${Math.round(n * 100)}%`;
const monthLabel = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "short", year: "2-digit" });

export default async function AnalyticsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const { period: raw } = await searchParams;
  const period = PERIODS.some(([k]) => k === raw) ? raw! : "12m";
  const { supabase } = await requireAdmin();
  const today = nyDay(new Date());
  const since = period === "ytd" ? yearStart(today) : period === "all" ? "2000-01-01" : addMonths(monthStart(today), -11);
  const a = await analyticsData(supabase, since);
  const service = (k: string) => SERVICE_CATEGORIES[k as keyof typeof SERVICE_CATEGORIES] ?? k;
  const source = (k: string) => LEAD_SOURCES[k as keyof typeof LEAD_SOURCES] ?? "Not recorded";
  const mostPopular = [...a.byService].sort((x, y) => y.bookings - x.bookings)[0];
  const mostProfitable = [...a.byService].sort((x, y) => y.profit - x.profit)[0];

  return <>
    <PageHeader eyebrow="Patterns" title="Analytics" subtitle="Based on bookings created in the period. Revenue here is money collected on those bookings." />
    <div className={s.toolbar}><Chips label="Period" items={PERIODS} current={period} hrefFor={(k) => (k === "12m" ? "/admin/analytics" : `/admin/analytics?period=${k}`)} /></div>
    <div className={s.kpis}>
      <Kpi label="Average booking value" value={usd(a.averageBookingValue)} hint={`${a.committed} committed bookings`} />
      <Kpi label="Inquiry → booking" value={a.total ? pct(a.conversion) : "—"} hint={`${a.committed} of ${a.total} requests`} />
      <Kpi label="Repeat clients" value={a.clients ? pct(a.repeatRate) : "—"} hint={`of ${a.clients} clients booked again`} />
      <Kpi label="Booking → shoot" value={a.avgLeadDays !== null ? `${a.avgLeadDays} days` : "—"} hint="Average lead time" />
      <Kpi label="Average open balance" value={usd(a.avgOutstanding)} hint="Per booking with money owed" />
      <Kpi label="Most profitable service" value={mostProfitable ? service(mostProfitable.key) : "—"} hint={mostPopular ? <>Most popular: <b>{service(mostPopular.key)}</b></> : undefined} />
    </div>
    <div className={`${s.grid2} ${s.section}`}>
      <Card title="Revenue by service"><Breakdown rows={a.byService.map((g) => ({ label: service(g.key), value: g.collected, note: `${g.bookings} · profit ${usd(g.profit)}` }))} format={usd} /></Card>
      <Card title="Revenue by package"><Breakdown rows={a.byPackage.slice(0, 10).map((g) => ({ label: g.key, value: g.collected, note: `${g.bookings}` }))} format={usd} /></Card>
      <Card title="Where clients come from"><Breakdown rows={a.bySource.map((g) => ({ label: source(g.key), value: g.collected, note: `${g.bookings} ${g.bookings === 1 ? "booking" : "bookings"}` }))} format={usd} /></Card>
      <Card title="Top clients"><Breakdown rows={a.topClients.map((g) => { const [, name] = g.key.split("|"); return { label: name, value: g.collected, note: `${g.bookings}` }; })} format={usd} /></Card>
      <Card title="Bookings by month"><Breakdown rows={a.byMonth.map((g) => ({ label: monthLabel.format(new Date(`${g.key}-01T12:00:00Z`)), value: g.bookings, note: usd(g.booked) + " booked" }))} format={(n) => String(n)} /></Card>
      <Card title="Profit by month"><p className={s.secondaryText} style={{ whiteSpace: "normal" }}>Monthly revenue, expenses and profit are charted on <Link className={s.rowLink} href="/admin/finances?range=12m">Finances</Link>, where the date range applies to every figure.</p></Card>
    </div>
  </>;
}
