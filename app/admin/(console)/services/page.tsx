import type { Metadata } from "next";
import s from "@/components/admin/admin.module.css";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { bookingAddons, bookingPackages } from "@/data/booking";
import { calEvents } from "@/lib/booking/config";
import { SERVICE_CATEGORIES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage() {
  const { supabase } = await requireAdmin();
  const { data } = await supabase.from("booking_ledger").select("package_id, status, total_cents, paid_cents").not("status", "in", "(new_inquiry,deposit_pending,canceled)");
  const stats = new Map<string, { count: number; collected: number }>();
  for (const b of data ?? []) {
    if (!b.package_id) continue;
    const st = stats.get(b.package_id) ?? { count: 0, collected: 0 };
    st.count += 1; st.collected += b.paid_cents; stats.set(b.package_id, st);
  }
  const live = calEvents();

  return <>
    <PageHeader eyebrow="Catalog" title="Services & packages" subtitle="The packages clients see on the booking site, with how each one is performing." />
    <Notice>Packages are edited in <code>data/booking.ts</code> today, because each price must match its Cal.com event and deposit. Moving the catalog into this admin is planned for a later phase (see docs/ADMIN.md).</Notice>
    <div className={s.stack}>
      {Object.entries(SERVICE_CATEGORIES).map(([cat, label]) => {
        const list = bookingPackages.filter((p) => p.category === cat);
        if (!list.length) return null;
        return <Card key={cat} title={label}>
          <div className={s.tableWrap} style={{ display: "block", overflowX: "auto" }}><table className={s.table}>
            <thead><tr><th>Package</th><th className={s.num}>Price</th><th className={s.num}>Deposit</th><th className={s.num}>Duration</th><th className={s.num}>Locations</th><th className={s.num}>Revisions</th><th>Online</th><th className={s.num}>Booked</th><th className={s.num}>Collected</th></tr></thead>
            <tbody>{list.map((p) => { const st = stats.get(p.id); return <tr key={p.id}>
              <td><b>{p.name}</b><div className={s.metaText}>{p.tagline}</div></td>
              <td className={s.num}>{p.inquiryOnly ? "Quote" : `${p.startingPrice ? "From " : ""}${usd(p.price)}`}</td>
              <td className={s.num}>{p.inquiryOnly ? "—" : usd(p.deposit)}</td>
              <td className={s.num}>{p.minutes ? `${p.minutes / 60} h` : "—"}</td>
              <td className={s.num}>{p.locationLabel ?? (p.locations || "—")}</td>
              <td className={s.num}>{p.revisions || "—"}</td>
              <td>{p.inquiryOnly ? <span className={s.metaText}>Inquiry</span> : live[p.id] ? <span className={`${s.badge} ${s.toneGood}`}>Bookable</span> : <span className={`${s.badge} ${s.toneMuted}`}>Not mapped</span>}</td>
              <td className={s.num}>{st?.count ?? 0}</td>
              <td className={s.num}>{usd(st?.collected ?? 0)}</td>
            </tr>; })}</tbody>
          </table></div>
        </Card>;
      })}
      <Card title="Add-ons">
        <ul className={s.list}>{bookingAddons.map((a) => <li key={a.id} className={s.listItem} style={{ padding: "10px 0" }}>
          <span className={s.mobileCardRow}><b>{a.name}</b><span className={s.amount}>{usd(a.price)}</span></span>
          <span className={s.metaText}>{a.description}</span>
        </li>)}</ul>
      </Card>
    </div>
  </>;
}
