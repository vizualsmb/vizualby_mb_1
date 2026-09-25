import type { Metadata } from "next";
import s from "@/components/admin/admin.module.css";
import { Card, Empty, Kpi, PageHeader } from "@/components/admin/ui";
import { ActionForm } from "@/components/admin/ActionForm";
import { ReceiptInput } from "@/components/admin/ReceiptInput";
import { Breakdown } from "@/components/admin/Breakdown";
import { RangeFilter } from "@/components/admin/RangeFilter";
import { requireAdmin } from "@/lib/admin/auth";
import { bookingOptions, listExpenses } from "@/lib/admin/queries";
import { addExpense, deleteExpense } from "@/lib/admin/actions";
import { EXPENSE_CATEGORIES, PAYMENT_METHODS } from "@/lib/admin/labels";
import { resolveRange } from "@/lib/admin/finance";
import { usd } from "@/lib/admin/money";
import { formatDay, formatShortDate, nyDay } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Expenses" };
const cat = (k: string) => EXPENSE_CATEGORIES[k as keyof typeof EXPENSE_CATEGORIES] ?? k;

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const range = resolveRange(params.range ?? "ytd", nyDay(new Date()), params);
  const [expenses, bookings] = await Promise.all([listExpenses(supabase, range), bookingOptions(supabase)]);
  const total = expenses.reduce((sum, e) => sum + e.amount_cents, 0);
  const byCategory = Object.entries(expenses.reduce<Record<string, number>>((acc, e) => ({ ...acc, [e.category]: (acc[e.category] ?? 0) + e.amount_cents }), {}))
    .sort((a, b) => b[1] - a[1]).map(([k, v]) => ({ label: cat(k), value: v }));
  const projectCosts = expenses.filter((e) => e.booking_id).reduce((sum, e) => sum + e.amount_cents, 0);

  return <>
    <PageHeader eyebrow="Money out" title="Expenses" subtitle="Every business cost, so profit is real profit." />
    <RangeFilter base="/admin/expenses" range={range} params={params} />
    <div className={s.kpis}>
      <Kpi label="Total expenses" value={usd(total)} hint={range.label} />
      <Kpi label="Linked to projects" value={usd(projectCosts)} hint="Direct production costs" />
      <Kpi label="Overhead" value={usd(total - projectCosts)} hint="Software, insurance, marketing…" />
    </div>

    <div className={`${s.detailGrid} ${s.section}`}>
      <div className={s.stack}>
        <Card title="Add an expense">
          <ActionForm action={addExpense} submit="Add expense" resetOnSuccess>
            <div className={s.formGrid}>
              <label className={`${s.field} ${s.fieldWide}`}>What was it?<input className={s.input} name="name" required maxLength={160} placeholder="e.g. Aputure 600d rental" /></label>
              <label className={s.field}>Amount ($)<input className={s.input} name="amount" inputMode="decimal" required /></label>
              <label className={s.field}>Date<input className={s.input} type="date" name="spent_on" required defaultValue={nyDay(new Date())} /></label>
              <label className={s.field}>Category<select className={s.input} name="category" required defaultValue="">{[<option key="" value="" disabled>Choose…</option>, ...Object.entries(EXPENSE_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)]}</select></label>
              <label className={s.field}>Vendor<input className={s.input} name="vendor" maxLength={120} /></label>
              <label className={s.field}>Paid with<select className={s.input} name="payment_method" defaultValue=""><option value="">—</option>{Object.entries(PAYMENT_METHODS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
              <label className={s.field}>Project (optional)<select className={s.input} name="booking_id" defaultValue=""><option value="">General business</option>{bookings.map((b) => <option key={b.id} value={b.id}>{b.client_name} — {b.project_title ?? b.package_name ?? "Project"}{b.shoot_start ? ` (${formatShortDate(b.shoot_start)})` : ""}</option>)}</select></label>
              <label className={s.field}>Notes<input className={s.input} name="notes" maxLength={1000} /></label>
              <ReceiptInput />
            </div>
          </ActionForm>
        </Card>
        <Card title={`${expenses.length} ${expenses.length === 1 ? "expense" : "expenses"}`}>
          {!expenses.length ? <Empty title="No expenses in this range">Add gear rentals, gas, subscriptions and crew as they happen.</Empty> :
            <ul className={s.list}>{expenses.map((e) => <li key={e.id} className={s.listItem} style={{ padding: "11px 0", display: "grid", gap: 3 }}>
              <span className={s.mobileCardRow}><span className={s.primaryText} style={{ whiteSpace: "normal" }}>{e.name}</span><span className={s.amount}>{usd(e.amount_cents)}</span></span>
              <span className={s.mobileCardRow}>
                <span className={s.metaText}>{formatDay(e.spent_on)} · {cat(e.category)}{e.vendor ? ` · ${e.vendor}` : ""}{e.booking_id ? " · project cost" : ""}{e.receipt_path && <> · <a className={s.rowLink} href={`/admin/receipts/${e.id}`} target="_blank" rel="noreferrer">Receipt</a></>}</span>
                <ActionForm action={deleteExpense} submit="Delete" variant="danger" className={s.formFoot} confirm={`Delete “${e.name}”?`}><input type="hidden" name="id" value={e.id} /></ActionForm>
              </span>
            </li>)}</ul>}
        </Card>
      </div>
      <Card title="By category"><Breakdown rows={byCategory} format={usd} empty="Nothing spent yet" /></Card>
    </div>
  </>;
}
