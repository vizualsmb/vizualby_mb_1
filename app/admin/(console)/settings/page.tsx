import type { Metadata } from "next";
import s from "@/components/admin/admin.module.css";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/admin/auth";
import { updateSettings } from "@/lib/admin/actions";
import { bookingEnabled, calEvents } from "@/lib/booking/config";

export const metadata: Metadata = { title: "Settings" };

// Reports whether each integration is configured. Never shows the values.
function integrations() {
  const redis = !!(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL);
  return [
    ["Admin database (Supabase)", !!process.env.SUPABASE_SECRET_KEY, "Stores bookings, clients, payments and expenses."],
    ["Stripe webhooks", !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET, `Mode: ${process.env.BOOKING_STRIPE_LIVE === "true" ? "live" : "test"}.`],
    ["Cal.com", !!process.env.CAL_API_KEY && !!process.env.CAL_WEBHOOK_SECRET, `${Object.keys(calEvents()).length} packages mapped to Cal event types.`],
    ["Booking store (Redis)", redis, "Checkout sessions and payment verification."],
    ["Online booking", bookingEnabled(), "All launch gates in docs/BOOKING.md must pass."],
    ["Email (Resend)", !!process.env.RESEND_API_KEY, "Used by the contact form; reminders come in Phase 5."],
  ] as const;
}

export default async function SettingsPage() {
  const { supabase, email } = await requireAdmin();
  const { data: st } = await supabase.from("business_settings").select("*").eq("id", true).single();

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
          <p className={s.hint}>The booking site still reads its deposit and policies from data/booking.ts and environment settings.</p>
        </ActionForm>
      </Card>
      <Card title="Connections">
        <ul className={s.list}>{integrations().map(([name, ok, note]) => <li key={name} className={s.listItem} style={{ padding: "12px 0", display: "grid", gap: 4 }}>
          <span className={s.mobileCardRow}><b>{name}</b><span className={`${s.badge} ${ok ? s.toneGood : s.toneWarn}`}>{ok ? "Connected" : "Not configured"}</span></span>
          <span className={s.metaText}>{note}</span>
        </li>)}</ul>
      </Card>
    </div>
  </>;
}
