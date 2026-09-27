"use client";

import { useActionState, useMemo, useState } from "react";
import { savePromotion, type ActionState } from "@/lib/admin/actions";
import { money } from "@/data/booking";
import type { AdminPromotion } from "@/lib/booking/promotions.server";
import s from "./admin.module.css";

type PackageOption = { id: string; name: string; price: number };

export function PromotionEditor({ packages, promotion, today }: { packages: PackageOption[]; promotion?: AdminPromotion; today: string }) {
  const defaultEnd = (() => { const date = new Date(`${today}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 30); return date.toISOString().slice(0, 10); })();
  const initialPackage = promotion?.package_id ?? packages[0]?.id ?? "";
  const packagePrice = packages.find((item) => item.id === initialPackage)?.price ?? 0;
  const [packageId, setPackageId] = useState(initialPackage);
  const [original, setOriginal] = useState(((promotion?.original_price_cents ?? packagePrice) / 100).toString());
  const [discounted, setDiscounted] = useState(((promotion?.discounted_price_cents ?? Math.round(packagePrice * .8)) / 100).toString());
  const [label, setLabel] = useState(promotion?.label ?? "SPECIAL RATE");
  const [valueNote, setValueNote] = useState(promotion?.value_note ?? "");
  const [state, action, pending] = useActionState(savePromotion, {} as ActionState);
  const selected = packages.find((item) => item.id === packageId);
  const cents = (value: string) => Math.max(0, Math.round(Number(value || 0) * 100));
  const savings = useMemo(() => Math.max(0, cents(original) - cents(discounted)), [original, discounted]);

  return <form action={action} className={s.form}>
    {promotion && <input type="hidden" name="id" value={promotion.id} />}
    <div className={s.formGrid}>
      <label className={s.field}>Package<select className={s.input} name="package_id" value={packageId} onChange={(event) => { const id = event.target.value; const price = packages.find((item) => item.id === id)?.price ?? 0; setPackageId(id); setOriginal((price / 100).toString()); setDiscounted((Math.round(price * .8) / 100).toString()); }}>{packages.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      <label className={s.field}>Original price ($)<input className={s.input} name="original_price" inputMode="decimal" value={original} onChange={(event) => setOriginal(event.target.value)} required /></label>
      <label className={s.field}>Deal price ($)<input className={s.input} name="discounted_price" inputMode="decimal" value={discounted} onChange={(event) => setDiscounted(event.target.value)} required /></label>
      <label className={s.field}>Savings display<select className={s.input} name="discount_type" defaultValue={promotion?.discount_type ?? "flat"}><option value="flat">Dollar savings</option><option value="percentage">Percentage savings</option></select></label>
      <label className={s.field}>Starts<input className={s.input} name="starts_on" type="date" defaultValue={promotion?.starts_on ?? today} required /></label>
      <label className={s.field}>Ends<input className={s.input} name="ends_on" type="date" defaultValue={promotion?.ends_on ?? defaultEnd} required /></label>
      <label className={s.field}>Booking deadline <span className={s.metaText}>Optional</span><input className={s.input} name="booking_deadline" type="date" defaultValue={promotion?.booking_deadline ?? ""} /></label>
      <label className={s.field}>Booking limit <span className={s.metaText}>Optional</span><input className={s.input} name="limited_quantity" type="number" min="1" max="10000" defaultValue={promotion?.limited_quantity ?? ""} placeholder="e.g. 3" /></label>
      <label className={s.field}>Promo label <span className={s.metaText}>Optional</span><input className={s.input} name="label" maxLength={40} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="SPECIAL RATE" /></label>
      <label className={s.field}>Promo code <span className={s.metaText}>Optional</span><input className={s.input} name="promo_code" maxLength={40} defaultValue={promotion?.promo_code ?? ""} autoCapitalize="characters" placeholder="Leave blank for no code" /></label>
      <label className={`${s.field} ${s.fieldWide}`}>Added-value message <span className={s.metaText}>Optional</span><input className={s.input} name="value_note" maxLength={160} value={valueNote} onChange={(event) => setValueNote(event.target.value)} placeholder="+ 2 vertical social edits included" /></label>
    </div>
    <label className={s.check}><input name="enabled" type="checkbox" defaultChecked={promotion?.enabled ?? false} /><span><b>Deal enabled</b><br />Only one enabled deal can run per package.</span></label>
    <div style={{ border: "1px solid #4b4437", background: "linear-gradient(145deg,#24221c,#171815)", padding: 20, display: "grid", gap: 7 }} aria-label="Customer-facing deal preview">
      <span style={{ color: "#c9a575", fontSize: 10, letterSpacing: ".15em" }}>{label || "PACKAGE DEAL"}</span>
      <strong style={{ fontSize: 18 }}>{selected?.name ?? "PACKAGE"}</strong>
      <span style={{ color: "#999", textDecoration: "line-through" }}>{money(cents(original))}</span>
      <strong style={{ color: "#eee", fontSize: 38, lineHeight: 1 }}>{money(cents(discounted))}</strong>
      <span style={{ color: "#c9a575", fontSize: 12 }}>SAVE {money(savings)}</span>
      {valueNote && <span style={{ color: "#d6d3c8", fontSize: 12 }}>{valueNote}</span>}
    </div>
    <div className={s.formFoot}>
      <button type="submit" disabled={pending} className={s.button}>{pending ? "Saving…" : promotion ? "Save deal" : "Create deal"}</button>
      {promotion && <button type="submit" name="intent" value="delete" formNoValidate disabled={pending} className={`${s.button} ${s.buttonDanger}`} onClick={(event) => { if (!window.confirm("Delete this deal? The package will return to its regular price.")) event.preventDefault(); }}>Delete deal</button>}
      <span aria-live="polite">{state.error && <span className={s.formError}>{state.error}</span>}{state.ok && state.message && <span className={s.formMessage}>{state.message}</span>}</span>
    </div>
  </form>;
}
