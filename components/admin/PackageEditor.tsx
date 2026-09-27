"use client";

import { useActionState } from "react";
import { saveServicePackage, type ActionState } from "@/lib/admin/actions";
import type { BookingPackage } from "@/data/booking";
import { SERVICE_CATEGORIES } from "@/lib/admin/labels";
import s from "./admin.module.css";

export function PackageEditor({ pkg, isNew = false, nextOrder = 100, active = true }: { pkg?: BookingPackage; isNew?: boolean; nextOrder?: number; active?: boolean }) {
  const [state, action, pending] = useActionState(saveServicePackage, {} as ActionState);
  return <form action={action} className={s.form}>
    <input type="hidden" name="is_new" value={isNew ? "yes" : "no"} />
    <p className={s.hint}>For packages connected to Cal.com, saving a published online package also updates and verifies its deposit price, full-payment price, title, and duration.</p>
    <div className={s.formGrid}>
      <label className={s.field}>Package ID<input className={s.input} name="package_id" required maxLength={60} pattern="[a-z0-9]+(?:-[a-z0-9]+)*" defaultValue={pkg?.id ?? ""} readOnly={!isNew} placeholder="music-performance" /><span className={s.hint}>{isNew ? "Lowercase letters, numbers, and hyphens." : "Permanent ID used by bookings and integrations."}</span></label>
      <label className={s.field}>Category<select className={s.input} name="category" defaultValue={pkg?.category ?? "music"}>{Object.entries(SERVICE_CATEGORIES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
      <label className={s.field}>Package name<input className={s.input} name="name" required maxLength={100} defaultValue={pkg?.name ?? ""} placeholder="Performance Visual" /></label>
      <label className={s.field}>Price ($)<input className={s.input} name="price" required inputMode="decimal" defaultValue={pkg ? (pkg.price / 100).toString() : ""} placeholder="1200" /></label>
      <label className={s.field}>Deposit percentage<input className={s.input} name="deposit_percent" type="number" min="0" max="100" step="0.01" defaultValue={pkg?.depositPercent ?? 50} /></label>
      <label className={s.field}>Duration (minutes)<input className={s.input} name="duration_minutes" type="number" min="0" max="4320" defaultValue={pkg?.minutes ?? 60} /></label>
      <label className={s.field}>Locations<input className={s.input} name="locations" type="number" min="0" max="100" defaultValue={pkg?.locations ?? 1} /></label>
      <label className={s.field}>Location label <span className={s.metaText}>Optional</span><input className={s.input} name="location_label" maxLength={80} defaultValue={pkg?.locationLabel ?? ""} placeholder="Multiple locations" /></label>
      <label className={s.field}>Revision rounds<input className={s.input} name="revisions" type="number" min="0" max="100" defaultValue={pkg?.revisions ?? 1} /></label>
      <label className={s.field}>Display order<input className={s.input} name="sort_order" type="number" min="0" max="10000" defaultValue={nextOrder} /></label>
      <label className={`${s.field} ${s.fieldWide}`}>Short description<input className={s.input} name="tagline" maxLength={240} defaultValue={pkg?.tagline ?? ""} placeholder="A concise reason this package is right for the client." /></label>
      <label className={`${s.field} ${s.fieldWide}`}>Delivery timeline<input className={s.input} name="delivery" maxLength={120} defaultValue={pkg?.delivery ?? ""} placeholder="10–14 business days" /></label>
      <label className={`${s.field} ${s.fieldWide}`}>What’s included <span className={s.metaText}>One item per line</span><textarea className={s.input} name="includes" required maxLength={4000} defaultValue={pkg?.includes.join("\n") ?? ""} rows={7} placeholder={"4 hours of filming\n1 location\nProfessional edit\nColor grading\n2 revisions"} /></label>
    </div>
    <div className={s.formGrid}>
      <label className={s.check}><input name="active" type="checkbox" defaultChecked={active} /><span><b>Published</b><br />Visible in the booking catalog.</span></label>
      <label className={s.check}><input name="featured" type="checkbox" defaultChecked={pkg?.featured ?? false} /><span><b>Studio pick</b><br />Adds the featured treatment.</span></label>
      <label className={s.check}><input name="starting_price" type="checkbox" defaultChecked={pkg?.startingPrice ?? false} /><span><b>Starting price</b><br />Displays “starting at.”</span></label>
      <label className={s.check}><input name="inquiry_only" type="checkbox" defaultChecked={pkg?.inquiryOnly ?? false} /><span><b>Inquiry only</b><br />Replaces checkout with a quote request.</span></label>
    </div>
    <div className={s.formFoot}><button type="submit" disabled={pending} className={s.button}>{pending ? "Saving…" : isNew ? "Create package" : "Save package"}</button><span aria-live="polite">{state.error && <span className={s.formError}>{state.error}</span>}{state.ok && state.message && <span className={s.formMessage}>{state.message}</span>}</span></div>
  </form>;
}
