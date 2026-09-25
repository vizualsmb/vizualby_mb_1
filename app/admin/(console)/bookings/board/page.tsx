import type { Metadata } from "next";
import Link from "next/link";
import { List } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import { PageHeader, PaymentBadge } from "@/components/admin/ui";
import { StatusSelect } from "@/components/admin/StatusSelect";
import { projectName } from "@/components/admin/bookings";
import { requireAdmin } from "@/lib/admin/auth";
import type { LedgerRow } from "@/lib/admin/queries";
import { usd } from "@/lib/admin/money";
import { formatShortDate } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Board" };

// Fifteen statuses fold into five lanes so the board fits a screen without sideways scrolling.
const LANES = [
  ["Leads", ["new_inquiry", "deposit_pending"]],
  ["Booked", ["deposit_paid", "confirmed", "pre_production", "shoot_scheduled"]],
  ["In post", ["shoot_completed", "editing", "client_review", "revision"]],
  ["Closing", ["final_payment_due", "paid"]],
  ["Delivered", ["delivered"]],
] as const;
const ACTIVE = LANES.flatMap(([, statuses]) => [...statuses]);

export default async function BoardPage() {
  const { supabase } = await requireAdmin();
  const { data, error } = await supabase.from("booking_ledger")
    .select("id, client_name, project_title, package_name, status, payment_state, shoot_start, balance_cents")
    .in("status", ACTIVE).order("shoot_start", { ascending: true, nullsFirst: false }).limit(300);
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as LedgerRow[];

  return <>
    <PageHeader eyebrow="Pipeline" title="Board" subtitle="Every active project by stage. Change a card's status to move it.">
      <Link href="/admin/bookings" className={`${s.button} ${s.buttonGhost}`}><List size={16} aria-hidden />List view</Link>
    </PageHeader>
    <div className={s.board}>
      {LANES.map(([title, statuses]) => {
        const cards = rows.filter((b) => (statuses as readonly string[]).includes(b.status));
        return <section key={title} className={s.lane} aria-label={title}>
          <div className={s.laneHead}><h2>{title}</h2><span className={s.metaText}>{cards.length}</span></div>
          {!cards.length && <p className={s.metaText} style={{ padding: "4px 2px 8px" }}>Nothing here</p>}
          {cards.map((b) => <article key={b.id} className={s.boardCard}>
            <Link href={`/admin/bookings/${b.id}`} className={s.rowLink} style={{ overflowWrap: "anywhere" }}>{b.client_name}</Link>
            <span className={s.secondaryText}>{projectName(b)}</span>
            <span className={s.mobileCardRow}><span className={s.metaText}>{b.shoot_start ? formatShortDate(b.shoot_start) : "No date"}</span>{b.balance_cents > 0 && <span className={s.metaText}>{usd(b.balance_cents)} due</span>}</span>
            {["overdue", "unpaid"].includes(b.payment_state) && <PaymentBadge state={b.payment_state} />}
            <StatusSelect id={b.id} status={b.status} />
          </article>)}
        </section>;
      })}
    </div>
  </>;
}
