import Link from "next/link";
import s from "./admin.module.css";
import { Empty, PaymentBadge, StatusBadge } from "./ui";
import { usd } from "@/lib/admin/money";
import { formatDay, formatShortDate, formatTime, TZ } from "@/lib/admin/time";
import type { LedgerRow } from "@/lib/admin/queries";

const chipMonth = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short" });
const chipDay = new Intl.DateTimeFormat("en-US", { timeZone: TZ, day: "numeric" });
export const projectName = (b: Pick<LedgerRow, "project_title" | "package_name">) =>
  [b.project_title, b.package_name && b.package_name !== b.project_title ? b.package_name : null].filter(Boolean).join(" — ") || "Untitled project";

export function DateChip({ iso }: { iso: string | null }) {
  if (!iso) return <span className={s.dateChip}><small>TBD</small><strong>—</strong></span>;
  const d = new Date(iso);
  return <span className={s.dateChip}><small>{chipMonth.format(d)}</small><strong>{chipDay.format(d)}</strong></span>;
}

export function UpcomingShoots({ rows }: { rows: LedgerRow[] }) {
  if (!rows.length) return <Empty title="No upcoming shoots">New website bookings appear here automatically. <Link className={s.cardLink} href="/admin/bookings/new">Add a booking manually →</Link></Empty>;
  return <ul className={s.list}>{rows.map((b) => <li key={b.id} className={s.listItem}>
    <Link href={`/admin/bookings/${b.id}`} className={s.listLink}>
      <DateChip iso={b.shoot_start} />
      <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
        <span className={s.primaryText}>{b.client_name}</span>
        <span className={s.secondaryText}>{projectName(b)}</span>
        <span className={s.metaText}>{formatShortDate(b.shoot_start)} · {formatTime(b.shoot_start)}{b.location ? ` · ${b.location}` : ""}</span>
      </span>
      <span className={s.alignEnd}>
        <StatusBadge status={b.status} />
        <span className={s.metaText}>{b.paid_cents > 0 ? `${usd(b.paid_cents)} paid` : "Nothing paid"}{b.balance_cents > 0 ? ` · ${usd(b.balance_cents)} due` : ""}</span>
      </span>
    </Link>
  </li>)}</ul>;
}

export function PaymentsDue({ rows }: { rows: LedgerRow[] }) {
  if (!rows.length) return <Empty title="Nothing outstanding">Every committed booking is paid up.</Empty>;
  return <ul className={s.list}>{rows.map((b) => <li key={b.id} className={s.listItem}>
    <Link href={`/admin/bookings/${b.id}`} className={s.listLink} style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}>
      <span style={{ minWidth: 0, display: "grid", gap: 2 }}>
        <span className={s.primaryText}>{b.client_name}</span>
        <span className={s.secondaryText}>{projectName(b)}</span>
        <span className={s.metaText}>Due {formatDay(b.due_date)}</span>
      </span>
      <span className={s.alignEnd}><span className={s.amount}>{usd(b.balance_cents)}</span><PaymentBadge state={b.payment_state} /></span>
    </Link>
  </li>)}</ul>;
}

export function BookingTable({ rows }: { rows: LedgerRow[] }) {
  if (!rows.length) return <div className={s.card}><Empty title="No bookings match">Try another filter or clear the search.</Empty></div>;
  return <>
    <div className={s.tableWrap}><table className={s.table}>
      <thead><tr><th>Client</th><th>Project</th><th>Shoot date</th><th className={s.num}>Total</th><th className={s.num}>Paid</th><th className={s.num}>Balance</th><th>Payment</th><th>Status</th><th>Source</th></tr></thead>
      <tbody>{rows.map((b) => <tr key={b.id}>
        <td><Link className={s.rowLink} href={`/admin/bookings/${b.id}`}>{b.client_name}</Link><div className={s.metaText}>{b.client_email}</div></td>
        <td style={{ maxWidth: 260 }}>{projectName(b)}</td>
        <td style={{ whiteSpace: "nowrap" }}>{formatShortDate(b.shoot_start)}<div className={s.metaText}>{formatTime(b.shoot_start)}</div></td>
        <td className={s.num}>{usd(b.total_cents)}</td>
        <td className={s.num}>{usd(b.paid_cents)}</td>
        <td className={s.num}>{usd(b.balance_cents)}</td>
        <td><PaymentBadge state={b.payment_state} /></td>
        <td><StatusBadge status={b.status} /></td>
        <td className={s.metaText}>{b.source === "website" ? "Website" : "Manual"}</td>
      </tr>)}</tbody>
    </table></div>
    <ul className={s.cards}>{rows.map((b) => <li key={b.id}><Link href={`/admin/bookings/${b.id}`} className={s.mobileCard}>
      <span className={s.mobileCardRow}><span className={s.primaryText}>{b.client_name}</span><StatusBadge status={b.status} /></span>
      <span className={s.secondaryText}>{projectName(b)}</span>
      <span className={s.mobileCardRow}><span className={s.metaText}>{formatShortDate(b.shoot_start)} {formatTime(b.shoot_start)}</span><PaymentBadge state={b.payment_state} /></span>
      <span className={s.mobileCardRow}><span className={s.metaText}>Total {usd(b.total_cents)} · Paid {usd(b.paid_cents)}</span><span className={s.amount}>{b.balance_cents > 0 ? `${usd(b.balance_cents)} due` : ""}</span></span>
    </Link></li>)}</ul>
  </>;
}
