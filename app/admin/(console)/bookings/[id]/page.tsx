import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import { Card, Empty, Notice, PageHeader, PaymentBadge, PaymentStatusBadge, StatusBadge } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { CopyField } from "@/components/admin/CopyField";
import { adminStripe } from "@/lib/admin/stripe";
import { projectName } from "@/components/admin/bookings";
import { requireAdmin } from "@/lib/admin/auth";
import { bookingDetail } from "@/lib/admin/queries";
import { addBookingNote, createBalancePaymentLink, recordPayment, refundManualPayment, updateBookingDetails, updateBookingStatus } from "@/lib/admin/actions";
import { BOOKING_STATUSES, EXPENSE_CATEGORIES, LEAD_SOURCES, PAYMENT_METHODS, PAYMENT_TYPES, statusLabel } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import { formatDate, formatDay, formatFullDate, formatTime, nyDay, nyTimeInput } from "@/lib/admin/time";
import { collectedCents } from "@/lib/admin/finance";
import { createProjectFromBooking } from "@/lib/admin/production-actions";

export const metadata: Metadata = { title: "Booking" };

const stamp = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
const EVENT_TEXT: Record<string, string> = { created: "Booking created", payment_received: "Payment received", payment_failed: "Payment failed", payment_refunded: "Refund", needs_review: "Needs review", note: "Note" };

export default async function BookingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireAdmin();
  const detail = await bookingDetail(supabase, id);
  if (!detail) notFound();
  const { booking: b, addons, payments, events, expenses } = detail;
  const hours = b.shoot_start && b.shoot_end ? (Date.parse(b.shoot_end) - Date.parse(b.shoot_start)) / 3600000 : null;
  const paidPct = b.total_cents ? Math.min(100, Math.round((b.paid_cents / b.total_cents) * 100)) : 0;
  const costs = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const stripeConfig = adminStripe();
  const stripeMode = stripeConfig ? (stripeConfig.testMode ? "test" : "live") : null;

  return <>
    <Link href="/admin/bookings" className={s.cardLink}><ArrowLeft size={14} aria-hidden style={{ marginRight: 6 }} />Bookings</Link>
    <PageHeader eyebrow={b.source === "website" ? "Website booking" : "Manual booking"} title={b.client_name} subtitle={projectName(b)}>
      <StatusBadge status={b.status} /><PaymentBadge state={b.payment_state} />
    </PageHeader>
    {events.some((e) => e.kind === "needs_review") && <Notice tone="bad">The payment on this booking did not match the quote. Check Stripe and Cal before confirming it with the client.</Notice>}

    <div className={s.detailGrid}>
      <div className={s.stack}>
        <Card title="Shoot">
          <dl className={s.facts}>
            <div><dt>Date</dt><dd>{b.shoot_start ? formatFullDate(b.shoot_start) : "Not scheduled"}</dd></div>
            <div><dt>Start time</dt><dd>{formatTime(b.shoot_start) || "—"}</dd></div>
            <div><dt>Estimated duration</dt><dd>{hours ? `${+hours.toFixed(2)} h` : "—"}</dd></div>
            <div><dt>Location</dt><dd>{b.location || "—"}</dd></div>
            <div><dt>Package</dt><dd>{b.package_name || "Custom"}</dd></div>
            <div><dt>Add-ons</dt><dd>{addons.length ? addons.map((a) => a.name).join(", ") : "None"}</dd></div>
            <div><dt>Lead source</dt><dd>{b.lead_source ? LEAD_SOURCES[b.lead_source as keyof typeof LEAD_SOURCES] : "Unknown"}{b.lead_source_detail ? ` — “${b.lead_source_detail}”` : ""}</dd></div>
            <div><dt>Booking ID</dt><dd className={s.metaText}>{b.reference ?? b.id}</dd></div>
          </dl>
        </Card>

        <Card title="Client">
          <dl className={s.facts}>
            <div><dt>Name</dt><dd><Link className={s.rowLink} href={`/admin/clients/${b.client_id}`}>{b.client_name}</Link></dd></div>
            <div><dt>Email</dt><dd>{b.client_email ? <a href={`mailto:${b.client_email}`}>{b.client_email}</a> : "—"}</dd></div>
            <div><dt>Phone</dt><dd>{b.client_phone ? <a href={`tel:${b.client_phone}`}>{b.client_phone}</a> : "—"}</dd></div>
            <div><dt>Company</dt><dd>{b.client_company || "—"}</dd></div>
          </dl>
          {b.project_description && <><h3 className={s.cardTitle} style={{ margin: "20px 0 8px" }}>Project brief</h3><p className={s.prose}>{b.project_description}</p></>}
          {b.client_message && <><h3 className={s.cardTitle} style={{ margin: "20px 0 8px" }}>References from client</h3><p className={s.prose}>{b.client_message}</p></>}
        </Card>

        <Card title="Details & notes">
          {b.notes && <p className={s.prose} style={{ marginBottom: 16 }}>{b.notes}</p>}
          <details className={s.disclosure}>
            <summary className={`${s.button} ${s.buttonGhost}`}>Edit booking</summary>
            <ActionForm action={updateBookingDetails} submit="Save changes">
              <input type="hidden" name="id" value={b.id} />
              <div className={s.formGrid}>
                <label className={`${s.field} ${s.fieldWide}`}>Project title<input className={s.input} name="project_title" defaultValue={b.project_title ?? ""} maxLength={160} /></label>
                <label className={s.field}>Shoot date<input className={s.input} type="date" name="shoot_day" defaultValue={b.shoot_start ? nyDay(b.shoot_start) : ""} /></label>
                <label className={s.field}>Start time<input className={s.input} type="time" name="shoot_time" defaultValue={b.shoot_start ? nyTimeInput(b.shoot_start) : ""} /></label>
                <label className={s.field}>Duration (hours)<input className={s.input} type="number" step="0.25" min="0.25" name="duration_hours" defaultValue={hours ?? ""} /></label>
                <label className={`${s.field} ${s.fieldWide}`}>Location<input className={s.input} name="location" defaultValue={b.location ?? ""} maxLength={250} /></label>
                <label className={s.field}>Balance due<input className={s.input} type="date" name="balance_due_date" defaultValue={b.balance_due_date ?? ""} /><span className={s.hint}>Blank = due on shoot day</span></label>
                <label className={s.field}>Deposit required ($)<input className={s.input} inputMode="decimal" name="deposit" defaultValue={(b.deposit_required_cents / 100).toString()} /></label>
                <label className={s.field}>Adjustment ($)<input className={s.input} inputMode="decimal" name="adjustment" defaultValue={b.adjustment_cents ? (b.adjustment_cents / 100).toString() : ""} placeholder="-50 discount, 100 extra" /></label>
                <label className={s.field}>Lead source<select className={s.input} name="lead_source" defaultValue={b.lead_source ?? ""}><option value="">Unknown</option>{Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className={`${s.field} ${s.fieldWide}`}>Internal notes<textarea className={s.input} name="notes" defaultValue={b.notes ?? ""} maxLength={5000} /></label>
              </div>
            </ActionForm>
          </details>
        </Card>

        <Card title="Timeline">
          <ActionForm action={addBookingNote} submit="Add note" variant="ghost" resetOnSuccess>
            <input type="hidden" name="id" value={b.id} />
            <label className={s.field}><span className={s.hint}>Log a call, a revision request, a delivery link…</span><input className={s.input} name="note" maxLength={1000} required /></label>
          </ActionForm>
          <ol className={s.timeline} style={{ marginTop: 22 }}>
            {events.map((e) => <li key={e.id} className={e.kind === "note" ? s.timelineNote : undefined}>
              <p style={{ fontWeight: 600 }}>{e.kind === "status_changed" ? `${statusLabel(e.to_status!)}` : EVENT_TEXT[e.kind] ?? e.kind}</p>
              {e.detail && <p className={s.secondaryText} style={{ whiteSpace: "normal" }}>{e.detail}</p>}
              {e.kind === "status_changed" && e.from_status && <p className={s.metaText}>from {statusLabel(e.from_status)}</p>}
              <p className={s.metaText}>{stamp.format(new Date(e.occurred_at))} · {e.actor === "admin" ? "You" : e.actor === "stripe" ? "Stripe" : e.actor === "cal" ? "Cal.com" : "Automatic"}</p>
            </li>)}
          </ol>
        </Card>
      </div>

      <div className={s.stack}>
        <Card title="Money">
          <dl className={s.moneyRows}>
            <div className={s.moneyRow}><dt>Package</dt><dd>{usd(b.package_price_cents)}</dd></div>
            {addons.map((a) => <div key={a.addon_id} className={s.moneyRow}><dt>{a.name}</dt><dd>{usd(a.price_cents)}</dd></div>)}
            {!addons.length && b.addons_cents > 0 && <div className={s.moneyRow}><dt>Add-ons</dt><dd>{usd(b.addons_cents)}</dd></div>}
            {b.adjustment_cents !== 0 && <div className={s.moneyRow}><dt>{b.adjustment_cents < 0 ? "Discount" : "Adjustment"}</dt><dd>{usd(b.adjustment_cents)}</dd></div>}
            <div className={`${s.moneyRow} ${s.moneyTotal}`}><dt>Total</dt><dd>{usd(b.total_cents)}</dd></div>
            <div className={s.moneyRow}><dt>Deposit required</dt><dd>{usd(b.deposit_required_cents)}</dd></div>
            <div className={s.moneyRow}><dt>Collected</dt><dd>{usd(b.paid_cents)}</dd></div>
            {b.refunded_cents > 0 && <div className={s.moneyRow}><dt>Refunded</dt><dd>{usd(b.refunded_cents)}</dd></div>}
            <div className={`${s.moneyRow} ${s.moneyTotal}`}><dt>Balance</dt><dd style={b.payment_state === "overdue" ? { color: "var(--bad)" } : undefined}>{usd(b.balance_cents)}</dd></div>
          </dl>
          <div className={s.progress} aria-hidden><span style={{ width: `${paidPct}%` }} /></div>
          <p className={s.metaText}>{paidPct}% paid{b.balance_cents > 0 ? ` · balance due ${formatDay(b.due_date)}` : ""}</p>
          {costs > 0 && <p className={s.metaText} style={{ marginTop: 6 }}>Project costs {usd(costs)} · margin {usd(b.paid_cents - costs)} so far</p>}
        </Card>

        <Card title="Project status">
          <ActionForm action={updateBookingStatus} submit="Update status" variant="ghost">
            <input type="hidden" name="id" value={b.id} />
            <select className={s.input} name="status" defaultValue={b.status} aria-label="Project status">
              {BOOKING_STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </ActionForm>
        </Card>

        <Card title="Production workspace">
          <p className={s.secondaryText} style={{ whiteSpace: "normal", marginBottom: 12 }}>Create a linked production project for tasks, workflow stages, and durable editing time. Booking, client, and payment data remain here.</p>
          <ActionForm action={createProjectFromBooking} submit="Create production project" variant="ghost"><input type="hidden" name="booking_id" value={b.id} /></ActionForm>
        </Card>

        {b.balance_cents > 0 && b.status !== "canceled" && <Card title="Collect the balance">
          {b.payment_link_url ? <div className={s.form}>
            <p className={s.secondaryText} style={{ whiteSpace: "normal" }}>Single-use Stripe link for <b>{usd(b.payment_link_cents ?? 0)}</b>. When the client pays, it is recorded here automatically.</p>
            <CopyField value={b.payment_link_url} label="Payment link" />
            {b.payment_link_cents !== b.balance_cents && <p className={s.hint}>The balance has changed since this link was made. Create a new one.</p>}
          </div> : <p className={s.secondaryText} style={{ whiteSpace: "normal", marginBottom: 12 }}>Create a secure Stripe link to text or email to the client.</p>}
          {stripeMode ? <details className={s.disclosure} style={{ marginTop: 12 }} open={!b.payment_link_url}>
            <summary className={`${s.button} ${s.buttonGhost}`}>{b.payment_link_url ? "Replace link" : "Create payment link"}</summary>
            <ActionForm action={createBalancePaymentLink} submit="Create link">
              <input type="hidden" name="id" value={b.id} />
              <label className={s.field}>Amount ($)<input className={s.input} name="amount" inputMode="decimal" defaultValue={(b.balance_cents / 100).toString()} /><span className={s.hint}>{stripeMode === "test" ? "Stripe test mode: no real money moves." : "Any previous link for this booking is switched off."}</span></label>
            </ActionForm>
          </details> : <p className={s.hint}>Connect Stripe (STRIPE_SECRET_KEY) to create payment links.</p>}
        </Card>}

        <Card title="Payments">
          {payments.length ? <ul className={s.list}>{payments.map((p) => <li key={p.id} className={s.listItem} style={{ padding: "11px 0", display: "grid", gap: 4 }}>
            <span className={s.mobileCardRow}><span className={s.amount}>{usd(p.amount_cents)}</span><PaymentStatusBadge status={p.status} /></span>
            <span className={s.metaText}>{PAYMENT_TYPES[p.type as keyof typeof PAYMENT_TYPES]} · {PAYMENT_METHODS[p.method as keyof typeof PAYMENT_METHODS]} · {formatDate(p.paid_at)}{p.refunded_cents ? ` · ${usd(p.refunded_cents)} refunded (net ${usd(collectedCents(p))})` : ""}</span>
            {p.stripe_payment_intent_id && <span className={s.metaText} style={{ overflowWrap: "anywhere" }}>{p.stripe_payment_intent_id}</span>}
            {p.notes && <span className={s.secondaryText}>{p.notes}</span>}
            {p.method !== "stripe" && p.refunded_cents < p.amount_cents && p.status !== "failed" && <details className={s.disclosure}>
              <summary className={s.cardLink}>Record a refund</summary>
              <ActionForm action={refundManualPayment} submit="Record refund" variant="danger" confirm="Record this refund? It reduces collected revenue.">
                <input type="hidden" name="id" value={p.id} />
                <label className={s.field}>Refunded amount ($)<input className={s.input} name="amount" inputMode="decimal" required /></label>
              </ActionForm>
            </details>}
          </li>)}</ul> : <Empty title="No payments yet">Stripe deposits appear automatically.</Empty>}
          <details className={s.disclosure} style={{ marginTop: 14 }}>
            <summary className={`${s.button} ${s.buttonGhost}`}>Record a payment</summary>
            <ActionForm action={recordPayment} submit="Record payment" resetOnSuccess>
              <input type="hidden" name="booking_id" value={b.id} />
              <div className={s.formGrid}>
                <label className={s.field}>Amount ($)<input className={s.input} name="amount" inputMode="decimal" required defaultValue={b.balance_cents ? (b.balance_cents / 100).toString() : ""} /></label>
                <label className={s.field}>Date<input className={s.input} type="date" name="paid_on" required defaultValue={nyDay(new Date())} /></label>
                <label className={s.field}>Type<select className={s.input} name="type" defaultValue={b.paid_cents ? "final" : "deposit"}>{Object.entries(PAYMENT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className={s.field}>Method<select className={s.input} name="method" defaultValue="zelle">{Object.entries(PAYMENT_METHODS).filter(([k]) => k !== "stripe").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
                <label className={`${s.field} ${s.fieldWide}`}>Note<input className={s.input} name="notes" maxLength={500} /></label>
              </div>
              <p className={s.hint}>For money received outside Stripe. Stripe payments sync on their own.</p>
            </ActionForm>
          </details>
        </Card>

        {expenses.length > 0 && <Card title="Project costs">
          <ul className={s.list}>{expenses.map((e) => <li key={e.id} className={s.listItem} style={{ padding: "9px 0" }}>
            <span className={s.mobileCardRow}><span>{e.name}</span><span className={s.amount}>{usd(e.amount_cents)}</span></span>
            <span className={s.metaText}>{EXPENSE_CATEGORIES[e.category as keyof typeof EXPENSE_CATEGORIES]} · {formatDay(e.spent_on)}</span>
          </li>)}</ul>
        </Card>}

        <p className={s.metaText}>Created {formatDate(b.created_at)} · Updated {formatDate(b.updated_at)}</p>
      </div>
    </div>
  </>;
}
