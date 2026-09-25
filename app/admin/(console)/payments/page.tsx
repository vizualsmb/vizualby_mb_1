import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Chips, Empty, PageHeader, Pagination, PaymentStatusBadge, hrefWith, pageNumber } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { PAGE_SIZE, listPayments } from "@/lib/admin/queries";
import { PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import { formatDate } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Payments" };
const FILTERS = [["all", "All"], ["succeeded", "Paid"], ["pending", "Pending"], ["failed", "Failed"], ["partially_refunded", "Partially refunded"], ["refunded", "Refunded"]] as const;
const label = <T extends object>(o: T, k: string) => (o as Record<string, string>)[k] ?? k;

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const page = pageNumber(params.page);
  const status = FILTERS.some(([k]) => k === params.status) && params.status !== "all" ? params.status : undefined;
  const { rows, total } = await listPayments(supabase, { status, page });
  const project = (r: (typeof rows)[number]) => r.bookings.project_title || r.bookings.package_name || "Project";

  return <>
    <PageHeader eyebrow="Money in" title="Payments" subtitle="Stripe payments sync automatically from verified webhooks. Off-Stripe payments are recorded on each booking." />
    <div className={s.toolbar}><Chips label="Filter payments" items={FILTERS} current={status ?? "all"} hrefFor={(k) => hrefWith("/admin/payments", {}, { status: k === "all" ? undefined : k })} /></div>
    {!rows.length ? <div className={s.card}><Empty title="No payments yet">When a client pays a deposit through the booking site it lands here.</Empty></div> : <>
      <div className={s.tableWrap}><table className={s.table}>
        <thead><tr><th>Date</th><th>Client</th><th>Project</th><th>Type</th><th>Method</th><th className={s.num}>Amount</th><th className={s.num}>Refunded</th><th>Status</th><th>Reference</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}>
          <td style={{ whiteSpace: "nowrap" }}>{formatDate(r.paid_at)}</td>
          <td><Link className={s.rowLink} href={`/admin/bookings/${r.booking_id}`}>{r.bookings.clients.name}</Link></td>
          <td>{project(r)}</td>
          <td>{label(PAYMENT_TYPES, r.type)}</td>
          <td>{label(PAYMENT_METHODS, r.method)}</td>
          <td className={s.num}>{usd(r.amount_cents)}</td>
          <td className={s.num}>{r.refunded_cents ? usd(r.refunded_cents) : "—"}</td>
          <td><PaymentStatusBadge status={r.status} /></td>
          <td className={s.metaText} style={{ maxWidth: 170, overflowWrap: "anywhere" }}>{r.stripe_payment_intent_id ?? r.id.slice(0, 8)}</td>
        </tr>)}</tbody>
      </table></div>
      <ul className={s.cards}>{rows.map((r) => <li key={r.id}><Link className={s.mobileCard} href={`/admin/bookings/${r.booking_id}`}>
        <span className={s.mobileCardRow}><span className={s.primaryText}>{r.bookings.clients.name}</span><span className={s.amount}>{usd(r.amount_cents)}</span></span>
        <span className={s.mobileCardRow}><span className={s.metaText}>{formatDate(r.paid_at)} · {label(PAYMENT_TYPES, r.type)} · {label(PAYMENT_METHODS, r.method)}</span><PaymentStatusBadge status={r.status} /></span>
      </Link></li>)}</ul>
    </>}
    <Pagination page={page} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => hrefWith("/admin/payments", params, { page: String(p) })} />
  </>;
}
