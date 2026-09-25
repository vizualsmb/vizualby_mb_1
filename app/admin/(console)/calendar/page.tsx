import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import c from "@/components/admin/calendar.module.css";
import { Card, Empty, PageHeader, StatusBadge } from "@/components/admin/ui";
import { DateChip, projectName } from "@/components/admin/bookings";
import { requireAdmin } from "@/lib/admin/auth";
import type { LedgerRow } from "@/lib/admin/queries";
import { isCommitted } from "@/lib/admin/finance";
import { usd } from "@/lib/admin/money";
import { addDays, addMonths, formatFullDate, formatTime, nyDay, startOfNyDay } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Calendar" };
const monthTitle = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" });
type Item = { day: string; kind: "shoot" | "due"; booking: LedgerRow };

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string }> }) {
  const { month: raw } = await searchParams;
  const today = nyDay(new Date());
  const first = /^\d{4}-(0[1-9]|1[0-2])$/.test(raw ?? "") ? `${raw}-01` : `${today.slice(0, 7)}-01`;
  const next = addMonths(first, 1);
  // Six-week grid starting on Sunday.
  const lead = new Date(`${first}T12:00:00Z`).getUTCDay();
  const gridStart = addDays(first, -lead);
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const gridEnd = addDays(gridStart, 42);

  const { supabase } = await requireAdmin();
  const cols = "id, client_name, project_title, package_name, status, payment_state, shoot_start, location, due_date, balance_cents";
  const [shoots, dues] = await Promise.all([
    supabase.from("booking_ledger").select(cols).neq("status", "canceled").gte("shoot_start", startOfNyDay(gridStart).toISOString()).lt("shoot_start", startOfNyDay(gridEnd).toISOString()).order("shoot_start"),
    supabase.from("booking_ledger").select(cols).gt("balance_cents", 0).gte("due_date", gridStart).lt("due_date", gridEnd),
  ]);
  if (shoots.error || dues.error) throw new Error("Could not load the calendar");
  const items: Item[] = [
    ...(shoots.data as unknown as LedgerRow[]).map((b) => ({ day: nyDay(b.shoot_start!), kind: "shoot" as const, booking: b })),
    ...(dues.data as unknown as LedgerRow[]).filter(isCommitted).map((b) => ({ day: b.due_date!, kind: "due" as const, booking: b })),
  ];
  const byDay = new Map<string, Item[]>();
  for (const it of items) byDay.set(it.day, [...(byDay.get(it.day) ?? []), it]);
  const agenda = items.filter((it) => it.day >= first && it.day < next).sort((a, b) => a.day.localeCompare(b.day) || (a.kind === "shoot" ? -1 : 1));

  return <>
    <PageHeader eyebrow="Schedule" title="Calendar" subtitle="Shoots and balance due dates from your bookings. Cal.com remains the source of availability for the booking site." />
    <Card>
      <div className={c.head}>
        <h2 className={c.month}>{monthTitle.format(new Date(`${first}T12:00:00Z`))}</h2>
        <div className={s.headActions}>
          <Link className={`${s.button} ${s.buttonGhost}`} href={`/admin/calendar?month=${addMonths(first, -1).slice(0, 7)}`} aria-label="Previous month"><ChevronLeft size={16} /></Link>
          <Link className={`${s.button} ${s.buttonGhost}`} href="/admin/calendar">Today</Link>
          <Link className={`${s.button} ${s.buttonGhost}`} href={`/admin/calendar?month=${next.slice(0, 7)}`} aria-label="Next month"><ChevronRight size={16} /></Link>
        </div>
      </div>
      <div className={c.grid} role="grid" aria-label="Month">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => <div key={d} className={c.dow} role="columnheader">{d}</div>)}
        {days.map((d) => {
          const list = byDay.get(d) ?? [];
          return <div key={d} role="gridcell" className={`${c.cell} ${d < first || d >= next ? c.outside : ""} ${d === today ? c.today : ""}`}>
            <span className={c.day}>{Number(d.slice(8))}</span>
            {list.map((it) => <Link key={it.kind + it.booking.id} href={`/admin/bookings/${it.booking.id}`}
              className={`${c.event} ${it.kind === "due" ? (it.booking.payment_state === "overdue" ? c.overdue : c.due) : ""}`}
              title={`${it.booking.client_name} — ${projectName(it.booking)}`}>
              {it.kind === "shoot" ? `${formatTime(it.booking.shoot_start)} ${it.booking.client_name}` : `${usd(it.booking.balance_cents)} due · ${it.booking.client_name}`}
            </Link>)}
            {list.length > 0 && <span className={c.dots} aria-label={`${list.length} items`}>{list.slice(0, 3).map((it) => <i key={it.kind + it.booking.id} className={it.kind === "due" ? c.dueDot : undefined} />)}</span>}
          </div>;
        })}
      </div>
      <div className={c.legend}><span><i style={{ background: "var(--revenue)" }} />Shoot</span><span><i style={{ background: "var(--warn)" }} />Balance due</span><span><i style={{ background: "var(--bad)" }} />Overdue</span></div>
    </Card>

    <div className={s.section}>
      <Card title="Agenda">
        {!agenda.length ? <Empty title="Nothing scheduled this month" /> : <ul className={s.list}>{agenda.map((it) => <li key={it.kind + it.booking.id} className={s.listItem}>
          <Link href={`/admin/bookings/${it.booking.id}`} className={s.listLink}>
            <DateChip iso={it.kind === "shoot" ? it.booking.shoot_start : `${it.day}T16:00:00Z`} />
            <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
              <span className={s.primaryText}>{it.kind === "shoot" ? it.booking.client_name : `Balance due — ${it.booking.client_name}`}</span>
              <span className={s.secondaryText}>{projectName(it.booking)}</span>
              <span className={s.metaText}>{it.kind === "shoot" ? `${formatFullDate(it.booking.shoot_start)} · ${formatTime(it.booking.shoot_start)}${it.booking.location ? ` · ${it.booking.location}` : ""}` : `${usd(it.booking.balance_cents)} outstanding`}</span>
            </span>
            <span className={s.alignEnd}><StatusBadge status={it.booking.status} /></span>
          </Link>
        </li>)}</ul>}
      </Card>
    </div>
  </>;
}
