import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import { Card, Empty, Kpi, PageHeader, PaymentStatusBadge } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { BookingTable, projectName } from "@/components/admin/bookings";
import { requireAdmin } from "@/lib/admin/auth";
import { clientDetail } from "@/lib/admin/queries";
import { removeClient, updateClient } from "@/lib/admin/actions";
import { CLIENT_TYPES, PAYMENT_METHODS, PAYMENT_TYPES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import { formatDate, formatFullDate } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Client" };

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const detail = await clientDetail(supabase, id);
  if (!detail) notFound();
  const { client: c, bookings, payments, last, next } = detail;
  const avg = c.booking_count ? Math.round(c.booked_value_cents / c.booking_count) : 0;
  const projectOf = new Map(bookings.map((b) => [b.id, projectName(b)]));

  return <>
    <Link href="/admin/clients" className={s.cardLink}><ArrowLeft size={14} aria-hidden style={{ marginRight: 6 }} />Clients</Link>
    <PageHeader eyebrow={CLIENT_TYPES[c.client_type as keyof typeof CLIENT_TYPES]} title={c.name} subtitle={[c.company, c.email, c.phone].filter(Boolean).join(" · ")}>
      <Link href={`/admin/bookings/new?client=${c.id}`} className={s.button}><Plus size={16} aria-hidden />New booking</Link>
    </PageHeader>
    <div className={s.kpis}>
      <Kpi label="Lifetime revenue" value={usd(c.lifetime_revenue_cents)} hint="Collected, net of refunds" />
      <Kpi label="Outstanding" value={usd(c.outstanding_cents)} />
      <Kpi label="Average booking" value={usd(avg)} hint={`${c.booking_count} ${c.booking_count === 1 ? "booking" : "bookings"}`} />
      <Kpi label="Client since" value={c.first_booking_at ? formatDate(c.first_booking_at).replace(/^\w+ \d+, /, "") : "—"} hint={c.first_booking_at ? formatDate(c.first_booking_at) : undefined} />
    </div>

    <div className={`${s.detailGrid} ${s.section}`}>
      <div className={s.stack}>
        <Card title="Bookings">{bookings.length ? <BookingTable rows={bookings} /> : <Empty title="No bookings yet" />}</Card>
        <Card title="Payment history">
          {payments.length ? <ul className={s.list}>{payments.map((p) => <li key={p.id} className={s.listItem} style={{ padding: "10px 0", display: "grid", gap: 3 }}>
            <span className={s.mobileCardRow}><span className={s.amount}>{usd(p.amount_cents)}</span><PaymentStatusBadge status={p.status} /></span>
            <span className={s.metaText}>{formatDate(p.paid_at)} · {PAYMENT_TYPES[p.type as keyof typeof PAYMENT_TYPES]} · {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]} · <Link href={`/admin/bookings/${p.booking_id}`}>{projectOf.get(p.booking_id)}</Link></span>
          </li>)}</ul> : <Empty title="No payments yet" />}
        </Card>
      </div>
      <div className={s.stack}>
        <Card title="At a glance">
          <dl className={s.moneyRows}>
            <div className={s.moneyRow}><dt>Last project</dt><dd>{last ? formatFullDate(last.shoot_start) : "—"}</dd></div>
            <div className={s.moneyRow}><dt>Next project</dt><dd>{next ? formatFullDate(next.shoot_start) : "—"}</dd></div>
            <div className={s.moneyRow}><dt>Booked value</dt><dd>{usd(c.booked_value_cents)}</dd></div>
            {c.social && <div className={s.moneyRow}><dt>Social</dt><dd style={{ overflowWrap: "anywhere" }}>{c.social}</dd></div>}
          </dl>
          {c.notes && <p className={s.prose} style={{ marginTop: 16 }}>{c.notes}</p>}
        </Card>
        <Card title="Contact & notes">
          <ActionForm action={updateClient} submit="Save client">
            <input type="hidden" name="id" value={c.id} />
            <div className={s.formGrid}>
              <label className={`${s.field} ${s.fieldWide}`}>Name<input className={s.input} name="name" defaultValue={c.name} required maxLength={120} /></label>
              <label className={s.field}>Email<input className={s.input} type="email" name="email" defaultValue={c.email ?? ""} /></label>
              <label className={s.field}>Phone<input className={s.input} type="tel" name="phone" defaultValue={c.phone ?? ""} /></label>
              <label className={s.field}>Company<input className={s.input} name="company" defaultValue={c.company ?? ""} /></label>
              <label className={s.field}>Instagram / social<input className={s.input} name="social" defaultValue={c.social ?? ""} /></label>
              <label className={`${s.field} ${s.fieldWide}`}>Client type<select className={s.input} name="client_type" defaultValue={c.client_type}>{Object.entries(CLIENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className={`${s.field} ${s.fieldWide}`}>Notes<textarea className={s.input} name="notes" defaultValue={c.notes ?? ""} maxLength={5000} /></label>
            </div>
          </ActionForm>
        </Card>
        <Card title="Remove client">
          <p className={s.secondaryText}>This hides the client from the directory while preserving their bookings, payments, and production history.</p>
          <ActionForm action={removeClient} submit="Remove client" variant="danger" confirm={`Remove ${c.name} from the client directory? Their booking and payment history will be preserved.`}>
            <input type="hidden" name="id" value={c.id} />
          </ActionForm>
        </Card>
      </div>
    </div>
  </>;
}
