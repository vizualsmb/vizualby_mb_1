import Link from "next/link";
import s from "./admin.module.css";
import { PAYMENT_STATES, PAYMENT_STATUSES, statusLabel } from "@/lib/admin/labels";

export function PageHeader({ eyebrow, title, subtitle, children }: { eyebrow?: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return <header className={s.pageHead}>
    <div>{eyebrow && <p className={s.eyebrow}>{eyebrow}</p>}<h1 className={s.title}>{title}</h1>{subtitle && <p className={s.subtitle}>{subtitle}</p>}</div>
    {children && <div className={s.headActions}>{children}</div>}
  </header>;
}

export function Card({ title, action, children, className }: { title?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={`${s.card} ${className ?? ""}`}>
    {title && <div className={s.cardHead}><h2 className={s.cardTitle}>{title}</h2>{action}</div>}
    {children}
  </section>;
}

export function Kpi({ label, value, hint, href, negative }: { label: string; value: string; hint?: React.ReactNode; href?: string; negative?: boolean }) {
  const body = <><p className={s.kpiLabel}>{label}</p><p className={s.kpiValue}>{value}</p>{hint && <p className={s.kpiHint}>{hint}</p>}</>;
  const cls = `${s.kpi} ${negative ? s.kpiNegative : ""}`;
  return href ? <Link href={href} className={cls}>{body}</Link> : <div className={cls}>{body}</div>;
}

const STATUS_TONE: Record<string, string> = {
  new_inquiry: s.toneGold, deposit_pending: s.toneWarn, final_payment_due: s.toneWarn, canceled: s.toneMuted, archived: s.toneMuted,
  paid: s.toneGood, delivered: s.toneGood, confirmed: s.toneGood, deposit_paid: s.toneGood,
};
export const StatusBadge = ({ status }: { status: string }) => <span className={`${s.badge} ${STATUS_TONE[status] ?? ""}`}>{statusLabel(status)}</span>;

const PAYMENT_TONE: Record<string, string> = { paid: s.toneGood, deposit_paid: s.toneGood, overdue: s.toneBad, unpaid: s.toneWarn, partially_paid: s.toneWarn, refunded: s.toneMuted, canceled: s.toneMuted };
export const PaymentBadge = ({ state }: { state: string }) =>
  <span className={`${s.badge} ${PAYMENT_TONE[state] ?? ""}`}>{PAYMENT_STATES[state as keyof typeof PAYMENT_STATES] ?? state}</span>;

const RECORD_TONE: Record<string, string> = { succeeded: s.toneGood, pending: s.toneWarn, failed: s.toneBad, refunded: s.toneMuted, partially_refunded: s.toneMuted };
export const PaymentStatusBadge = ({ status }: { status: string }) =>
  <span className={`${s.badge} ${RECORD_TONE[status] ?? ""}`}>{PAYMENT_STATUSES[status as keyof typeof PAYMENT_STATUSES] ?? status}</span>;

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className={s.empty}><strong>{title}</strong>{children}</div>;
}

export function Notice({ tone, children }: { tone?: "bad"; children: React.ReactNode }) {
  return <div className={`${s.notice} ${tone === "bad" ? s.noticeBad : ""}`} role={tone === "bad" ? "alert" : "status"}>{children}</div>;
}

// Links that preserve the rest of the query string.
export function hrefWith(base: string, params: Record<string, string | undefined>, patch: Record<string, string | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, ...patch })) if (v) q.set(k, v);
  const str = q.toString();
  return str ? `${base}?${str}` : base;
}

export function Chips({ items, current, hrefFor, label }: { items: readonly (readonly [string, string])[]; current: string; hrefFor: (key: string) => string; label: string }) {
  return <nav className={s.chips} aria-label={label}>
    {items.map(([key, text]) => <Link key={key} href={hrefFor(key)} className={s.chip} aria-current={key === current ? "true" : undefined} scroll={false}>{text}</Link>)}
  </nav>;
}

export function SearchForm({ action, q, hidden, placeholder }: { action: string; q?: string; hidden?: Record<string, string | undefined>; placeholder: string }) {
  return <form action={action} className={s.search} role="search">
    {Object.entries(hidden ?? {}).map(([k, v]) => v ? <input key={k} type="hidden" name={k} value={v} /> : null)}
    <input className={s.input} type="search" name="q" defaultValue={q} placeholder={placeholder} aria-label={placeholder} />
    <button className={`${s.button} ${s.buttonGhost}`} type="submit">Search</button>
  </form>;
}

export function Pagination({ page, total, pageSize, hrefFor }: { page: number; total: number; pageSize: number; hrefFor: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return <p className={s.pagination}>{total} {total === 1 ? "result" : "results"}</p>;
  return <nav className={s.pagination} aria-label="Pagination">
    <span>Page {page} of {pages} · {total} results</span>
    <span className={s.headActions}>
      {page > 1 && <Link className={`${s.button} ${s.buttonGhost}`} href={hrefFor(page - 1)}>Previous</Link>}
      {page < pages && <Link className={`${s.button} ${s.buttonGhost}`} href={hrefFor(page + 1)}>Next</Link>}
    </span>
  </nav>;
}

export const pageNumber = (v?: string) => Math.min(1000, Math.max(1, Number.parseInt(v || "1", 10) || 1));
