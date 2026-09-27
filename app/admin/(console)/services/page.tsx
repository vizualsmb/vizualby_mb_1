import type { Metadata } from "next";
import s from "@/components/admin/admin.module.css";
import { Card, Notice, PageHeader } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { bookingAddons, bookingPackages } from "@/data/booking";
import { calEvents } from "@/lib/booking/config";
import { SERVICE_CATEGORIES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import type { AdminPromotion } from "@/lib/booking/promotions.server";
import { PromotionEditor } from "@/components/admin/PromotionEditor";
import { PackageEditor } from "@/components/admin/PackageEditor";
import { packageFromRow, packageRows } from "@/lib/booking/catalog.server";

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
  const { data: promotionRows } = await supabase.from("promotions").select("*").order("created_at", { ascending: false });
  const promotions = (promotionRows ?? []) as AdminPromotion[];
  const storedPackages = await packageRows(supabase);
  const storedById = new Map(storedPackages.map((row) => [row.package_id, row]));
  const catalog = bookingPackages.map((pkg) => storedById.has(pkg.id) ? packageFromRow(storedById.get(pkg.id)!) : pkg);
  for (const row of storedPackages) if (!bookingPackages.some((pkg) => pkg.id === row.package_id)) catalog.push(packageFromRow(row));
  catalog.sort((a, b) => (storedById.get(a.id)?.sort_order ?? (bookingPackages.findIndex((pkg) => pkg.id === a.id) + 1) * 10) - (storedById.get(b.id)?.sort_order ?? (bookingPackages.findIndex((pkg) => pkg.id === b.id) + 1) * 10));
  const activeIds = new Set(catalog.filter((pkg) => storedById.get(pkg.id)?.active !== false).map((pkg) => pkg.id));
  const promotable = catalog.filter((p) => activeIds.has(p.id) && !p.inquiryOnly).map(({ id, name, price }) => ({ id, name, price }));
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  return <>
    <PageHeader eyebrow="Catalog" title="Services, packages & deals" subtitle="Create, publish, price, and promote what clients can book—without editing code." />
    <Notice>Published package changes feed the booking site. A new online-checkout package also needs a matching Cal.com mapping; until then it safely appears as a request-only package. Deal prices must match the corresponding Cal.com deposit or full-payment event.</Notice>
    <div className={s.stack}>
      <Card title="Add a new package"><details className={s.disclosure}><summary className={`${s.button} ${s.buttonGhost}`}>Create package</summary><PackageEditor isNew nextOrder={catalog.length * 10 + 10} /></details></Card>
      <Card title="Package catalog">
        <div className={s.catalogGroups}>{Object.entries(SERVICE_CATEGORIES).map(([cat, label]) => {
          const list = catalog.filter((p) => p.category === cat);
          if (!list.length) return null;
          return <details className={s.catalogGroup} key={cat} open={cat === "content" || cat === "music"}>
            <summary>{label}<span>{list.length} package{list.length === 1 ? "" : "s"}</span></summary>
            <div className={s.tableWrap} style={{ display: "block", overflowX: "auto" }}><table className={s.table}>
            <thead><tr><th>Package</th><th className={s.num}>Price</th><th className={s.num}>Deposit</th><th className={s.num}>Duration</th><th>Status</th><th className={s.num}>Booked</th><th className={s.num}>Collected</th><th>Edit</th></tr></thead>
            <tbody>{list.map((p) => { const st = stats.get(p.id); return <tr key={p.id}>
              <td><b>{p.name}</b><div className={s.metaText}>{p.tagline}</div></td>
              <td className={s.num}>{p.inquiryOnly ? "Quote" : `${p.startingPrice ? "From " : ""}${usd(p.price)}`}</td>
              <td className={s.num}>{p.inquiryOnly ? "—" : usd(p.deposit)}</td>
              <td className={s.num}>{p.minutes ? `${p.minutes / 60} h` : "—"}</td>
              <td>{!activeIds.has(p.id) ? <span className={`${s.badge} ${s.toneMuted}`}>Archived</span> : p.inquiryOnly ? <span className={s.metaText}>Inquiry</span> : live[p.id] ? <span className={`${s.badge} ${s.toneGood}`}>Bookable</span> : <span className={`${s.badge} ${s.toneMuted}`}>Request only</span>}</td>
              <td className={s.num}>{st?.count ?? 0}</td>
              <td className={s.num}>{usd(st?.collected ?? 0)}</td>
              <td><details className={s.disclosure}><summary className={`${s.button} ${s.buttonGhost}`}>Edit</summary><div style={{ minWidth: "min(760px, 80vw)", marginTop: 14 }}><PackageEditor pkg={p} active={activeIds.has(p.id)} nextOrder={storedById.get(p.id)?.sort_order ?? list.indexOf(p) * 10 + 10} /></div></details></td>
            </tr>; })}</tbody>
            </table></div>
          </details>;
        })}</div>
      </Card>
      <Card title="Add a package deal"><PromotionEditor packages={promotable} today={today} /></Card>
      {promotions.length > 0 && <Card title={`Saved deals (${promotions.length})`}>
        <div className={s.dealGrid}>{promotions.map((promotion) => {
          const pkg = catalog.find((p) => p.id === promotion.package_id);
          return <article className={s.dealCard} key={promotion.id}>
            <div className={s.dealSummary}>
              <div><span className={`${s.badge} ${promotion.enabled ? s.toneGood : s.toneMuted}`}>{promotion.enabled ? "Enabled" : "Disabled"}</span><strong>{pkg?.name ?? promotion.package_id}</strong><p>{promotion.starts_on} → {promotion.ends_on}</p></div>
              <span className={s.dealPrice}>{usd(promotion.original_price_cents)} → {usd(promotion.discounted_price_cents)}</span>
            </div>
            <details className={s.disclosure}><summary className={`${s.button} ${s.buttonGhost}`}>Edit deal</summary><div className={s.dealEditor}><PromotionEditor packages={promotable} promotion={promotion} today={today} /></div></details>
          </article>;
        })}</div>
      </Card>}
      <Card title="Add-ons">
        <ul className={s.list}>{bookingAddons.map((a) => <li key={a.id} className={s.listItem} style={{ padding: "10px 0" }}>
          <span className={s.mobileCardRow}><b>{a.name}</b><span className={s.amount}>{usd(a.price)}</span></span>
          <span className={s.metaText}>{a.description}</span>
        </li>)}</ul>
      </Card>
    </div>
  </>;
}
