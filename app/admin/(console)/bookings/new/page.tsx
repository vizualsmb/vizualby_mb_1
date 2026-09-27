import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import { Card, PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { requireAdmin } from "@/lib/admin/auth";
import { createBooking } from "@/lib/admin/actions";
import { catalogPackages } from "@/lib/booking/catalog.server";
import { BOOKING_STATUSES, LEAD_SOURCES, SERVICE_CATEGORIES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({ searchParams }: { searchParams: Promise<{ client?: string }> }) {
  const { client } = await searchParams;
  const { supabase } = await requireAdmin();
  const { data: clients } = await supabase.from("clients").select("id, name, email").order("name").limit(500);
  const packages = await catalogPackages(supabase);
  const groups = Object.entries(SERVICE_CATEGORIES).map(([id, label]) => [label, packages.filter((p) => p.category === id && !p.inquiryOnly)] as const).filter(([, list]) => list.length);

  return <>
    <Link href="/admin/bookings" className={s.cardLink}><ArrowLeft size={14} aria-hidden style={{ marginRight: 6 }} />Bookings</Link>
    <PageHeader eyebrow="Manual entry" title="New booking" subtitle="For bookings arranged by DM, phone or email. Website bookings are created automatically." />
    <Card>
      <ActionForm action={createBooking} submit="Create booking">
        <h2 className={s.cardTitle}>Client</h2>
        <div className={s.formGrid}>
          <label className={`${s.field} ${s.fieldWide}`}>Existing client
            <select className={s.input} name="client_id" defaultValue={client ?? ""}>
              <option value="">— New client (fill in below) —</option>
              {(clients ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` · ${c.email}` : ""}</option>)}
            </select>
          </label>
          <label className={s.field}>New client name<input className={s.input} name="client_name" maxLength={120} /></label>
          <label className={s.field}>Email<input className={s.input} type="email" name="client_email" maxLength={160} /></label>
          <label className={s.field}>Phone<input className={s.input} type="tel" name="client_phone" maxLength={30} /></label>
        </div>

        <h2 className={s.cardTitle} style={{ marginTop: 8 }}>Project</h2>
        <div className={s.formGrid}>
          <label className={`${s.field} ${s.fieldWide}`}>Package
            <select className={s.input} name="package_id" defaultValue="">
              <option value="">Custom project</option>
              {groups.map(([label, list]) => <optgroup key={label} label={label}>{list.map((p) => <option key={p.id} value={p.id}>{p.name} — {usd(p.price)}</option>)}</optgroup>)}
            </select>
            <span className={s.hint}>Leave price blank to use the package price and its 50% deposit.</span>
          </label>
          <label className={`${s.field} ${s.fieldWide}`}>Project title<input className={s.input} name="project_title" maxLength={160} placeholder="e.g. “Midnight” music video" /></label>
          <label className={s.field}>Agreed price ($)<input className={s.input} name="price" inputMode="decimal" /></label>
          <label className={s.field}>Deposit required ($)<input className={s.input} name="deposit" inputMode="decimal" /></label>
          <label className={s.field}>Status<select className={s.input} name="status" defaultValue="new_inquiry">{BOOKING_STATUSES.map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label className={s.field}>Lead source<select className={s.input} name="lead_source" defaultValue=""><option value="">Unknown</option>{Object.entries(LEAD_SOURCES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>

        <h2 className={s.cardTitle} style={{ marginTop: 8 }}>Shoot</h2>
        <div className={s.formGrid}>
          <label className={s.field}>Date<input className={s.input} type="date" name="shoot_day" /></label>
          <label className={s.field}>Start time<input className={s.input} type="time" name="shoot_time" /></label>
          <label className={s.field}>Duration (hours)<input className={s.input} type="number" name="duration_hours" step="0.25" min="0.25" /></label>
          <label className={`${s.field} ${s.fieldWide}`}>Location<input className={s.input} name="location" maxLength={250} /></label>
          <label className={`${s.field} ${s.fieldWide}`}>Notes<textarea className={s.input} name="notes" maxLength={5000} /></label>
        </div>
      </ActionForm>
    </Card>
  </>;
}
