import type { Metadata } from "next";
import s from "@/components/admin/admin.module.css";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/admin/auth";
import { runAutomationNow, syncExistingBookings, updateSettings } from "@/lib/admin/actions";
import { bookingEnabled, calEvents } from "@/lib/booking/config";
import { formatDate } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Settings" };
const MESSAGE_LABELS: Record<string, string> = { shoot_reminder: "Shoot reminder", balance_due: "Balance reminder", balance_overdue: "Overdue notice", admin_new_booking: "New booking alert", admin_payment: "Payment alert" };

// Reports whether each integration is configured. Never shows the values.
function integrations() {
  const redis = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
  return [
    ["Admin database (Supabase)", !!process.env.SUPABASE_SECRET_KEY, "Stores bookings, clients, payments and expenses."],
    ["Stripe webhooks", !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET, `Mode: ${process.env.BOOKING_STRIPE_LIVE === "true" ? "live" : "test"}.`],
    ["Cal.com", !!process.env.CAL_API_KEY && !!process.env.CAL_WEBHOOK_SECRET, `${Object.keys(calEvents()).length} packages mapped to Cal event types.`],
    ["Booking store (Redis)", redis, "Checkout sessions and payment verification."],
    ["Online booking", bookingEnabled(), "All launch gates in docs/BOOKING.md must pass."],
    ["Email (Resend)", !!process.env.RESEND_API_KEY && !!process.env.CONTACT_FROM_EMAIL, "Sends reminders and admin alerts from CONTACT_FROM_EMAIL."],
    ["Daily automation (Vercel Cron)", !!process.env.CRON_SECRET, "Runs every morning at 9 AM New York time (8 AM in winter)."],
  ] as const;
}

export default async function SettingsPage() {
  const { supabase, email } = await requireAdmin();
  const [{ data: st }, { data: sent }] = await Promise.all([
    supabase.from("business_settings").select("*").eq("id", true).single(),
    supabase.from("notifications").select("id, kind, recipient, status, created_at, booking_id").order("created_at", { ascending: false }).limit(12),
  ]);

  return <>
    <PageHeader eyebrow="Studio" title="Settings" subtitle={`Signed in as ${email}.`} />
    <div className={s.detailGrid}>
      <Card title="Business">
        <ActionForm action={updateSettings} submit="Save settings">
          <div className={s.formGrid}>
            <label className={s.field}>Business name<input className={s.input} name="business_name" required defaultValue={st?.business_name ?? "Vizuals by MB"} /></label>
            <label className={s.field}>Email<input className={s.input} type="email" name="email" defaultValue={st?.email ?? ""} /></label>
            <label className={s.field}>Phone<input className={s.input} type="tel" name="phone" defaultValue={st?.phone ?? ""} /></label>
            <label className={s.field}>Currency<input className={s.input} value="USD" disabled /></label>
            <label className={`${s.field} ${s.fieldWide}`}>Business address<input className={s.input} name="address" defaultValue={st?.address ?? ""} /></label>
            <label className={s.field}>Default deposit (%)<input className={s.input} type="number" name="default_deposit_percent" min={0} max={100} step="0.5" defaultValue={st?.default_deposit_percent ?? 50} /></label>
            <label className={s.field}>Tax (%)<input className={s.input} type="number" name="tax_percent" min={0} max={100} step="0.01" defaultValue={st?.tax_percent ?? 0} /></label>
            <label className={`${s.field} ${s.fieldWide}`}>Payment terms<textarea className={s.input} name="payment_terms" defaultValue={st?.payment_terms ?? ""} /></label>
            <label className={`${s.field} ${s.fieldWide}`}>Cancellation terms<textarea className={s.input} name="cancellation_terms" defaultValue={st?.cancellation_terms ?? ""} /></label>
            <label className={`${s.field} ${s.fieldWide}`}>Invoice terms<textarea className={s.input} name="invoice_terms" defaultValue={st?.invoice_terms ?? ""} /></label>
          </div>
          <h2 className={s.cardTitle} style={{ marginTop: 8 }}>Automation</h2>
          <div className={s.formGrid}>
            <label className={`${s.field} ${s.fieldWide} ${s.check}`}><input type="checkbox" name="client_emails_enabled" defaultChecked={st?.client_emails_enabled ?? false} /><span><b>Email clients automatically</b><br />Shoot reminder the day before, a balance reminder before the due date, and one notice if it becomes overdue.</span></label>
            <label className={`${s.field} ${s.fieldWide} ${s.check}`}><input type="checkbox" name="admin_emails_enabled" defaultChecked={st?.admin_emails_enabled ?? true} /><span><b>Email me</b> about new website bookings and payments received.</span></label>
            <label className={`${s.field} ${s.fieldWide} ${s.check}`}><input type="checkbox" name="auto_status_enabled" defaultChecked={st?.auto_status_enabled ?? true} /><span><b>Move projects forward automatically</b><br />After the shoot: Shoot completed, then Editing the next day. Delivered projects are archived after the period below.</span></label>
            <label className={s.field}>Balance reminder (days before due)<input className={s.input} type="number" name="reminder_days_before_due" min={0} max={30} defaultValue={st?.reminder_days_before_due ?? 3} /></label>
            <label className={s.field}>Archive delivered after (days)<input className={s.input} type="number" name="archive_after_days" min={1} max={365} defaultValue={st?.archive_after_days ?? ""} placeholder="Never" /></label>
          </div>
          <p className={s.hint}>The booking site still reads its deposit and policies from data/booking.ts and environment settings. Cal.com sends booking confirmations and Stripe sends payment receipts.</p>
        </ActionForm>
      </Card>
      <Card title="Connections">
        <ul className={s.list}>{integrations().map(([name, ok, note]) => <li key={name} className={s.listItem} style={{ padding: "12px 0", display: "grid", gap: 4 }}>
          <span className={s.mobileCardRow}><b>{name}</b><span className={`${s.badge} ${ok ? s.toneGood : s.toneWarn}`}>{ok ? "Connected" : "Not configured"}</span></span>
          <span className={s.metaText}>{note}</span>
        </li>)}</ul>
        <div style={{ marginTop: 18 }}>
          <ActionForm action={syncExistingBookings} submit="Sync existing website bookings" variant="ghost"><p className={s.hint}>Imports bookings already stored by the live website. Safe to repeat: clients, bookings and Stripe payments are upserted instead of duplicated.</p></ActionForm>
        </div>
        <div style={{ marginTop: 18 }}>
          <ActionForm action={runAutomationNow} submit="Run daily automation now" variant="ghost"><p className={s.hint}>Runs the same job as the morning schedule. Safe to repeat: nothing is sent twice.</p></ActionForm>
        </div>
        <h3 className={s.cardTitle} style={{ margin: "22px 0 8px" }}>Recent messages</h3>
        {sent?.length ? <ul className={s.list}>{sent.map((n) => <li key={n.id} className={s.listItem} style={{ padding: "9px 0", display: "grid", gap: 2 }}>
          <span className={s.mobileCardRow}><span>{MESSAGE_LABELS[n.kind] ?? n.kind}</span><span className={`${s.badge} ${n.status === "sent" ? s.toneGood : n.status === "failed" ? s.toneBad : s.toneWarn}`}>{n.status}</span></span>
          <span className={s.metaText} style={{ overflowWrap: "anywhere" }}>{n.recipient} · {formatDate(n.created_at)}</span>
        </li>)}</ul> : <p className={s.metaText}>No automated messages yet.</p>}
      </Card>
    </div>
  </>;
}
