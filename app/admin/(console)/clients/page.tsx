import type { Metadata } from "next";
import Link from "next/link";
import s from "@/components/admin/admin.module.css";
import { Chips, Empty, PageHeader, Pagination, SearchForm, hrefWith, pageNumber } from "@/components/admin/ui";
import { requireAdmin } from "@/lib/admin/auth";
import { PAGE_SIZE, listClients } from "@/lib/admin/queries";
import { CLIENT_TYPES } from "@/lib/admin/labels";
import { usd } from "@/lib/admin/money";
import { formatDate } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Clients" };
const SORTS = [["recent", "Recent"], ["revenue", "Top revenue"]] as const;

export default async function ClientsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const page = pageNumber(params.page);
  const sort = params.sort === "revenue" ? "revenue" : "recent";
  const { rows, total } = await listClients(supabase, { q: params.q, page, sort });
  const type = (t: string) => CLIENT_TYPES[t as keyof typeof CLIENT_TYPES] ?? t;

  return <>
    <PageHeader eyebrow="Relationships" title="Clients" subtitle="Created automatically from bookings, matched by email." />
    <div className={s.toolbar}>
      <Chips label="Sort clients" items={SORTS} current={sort} hrefFor={(k) => hrefWith("/admin/clients", { q: params.q }, { sort: k === "recent" ? undefined : k })} />
      <SearchForm action="/admin/clients" q={params.q} hidden={{ sort: params.sort }} placeholder="Name, email, phone, company, @handle" />
    </div>
    {!rows.length ? <div className={s.card}><Empty title={params.q ? "No clients match" : "No clients yet"}>{params.q ? "Try a different search." : "Your first website booking will create one."}</Empty></div> : <>
      <div className={s.tableWrap}><table className={s.table}>
        <thead><tr><th>Client</th><th>Type</th><th className={s.num}>Bookings</th><th className={s.num}>Lifetime revenue</th><th className={s.num}>Outstanding</th><th>Last booking</th></tr></thead>
        <tbody>{rows.map((c) => <tr key={c.id}>
          <td><Link className={s.rowLink} href={`/admin/clients/${c.id}`}>{c.name}</Link><div className={s.metaText}>{c.company || c.email}</div></td>
          <td className={s.metaText}>{type(c.client_type)}</td>
          <td className={s.num}>{c.booking_count}{c.booking_count > 1 && <span className={s.metaText}> · repeat</span>}</td>
          <td className={s.num}>{usd(c.lifetime_revenue_cents)}</td>
          <td className={s.num}>{c.outstanding_cents ? usd(c.outstanding_cents) : "—"}</td>
          <td className={s.metaText}>{formatDate(c.last_booking_at)}</td>
        </tr>)}</tbody>
      </table></div>
      <ul className={s.cards}>{rows.map((c) => <li key={c.id}><Link className={s.mobileCard} href={`/admin/clients/${c.id}`}>
        <span className={s.mobileCardRow}><span className={s.primaryText}>{c.name}</span><span className={s.amount}>{usd(c.lifetime_revenue_cents)}</span></span>
        <span className={s.metaText}>{type(c.client_type)} · {c.booking_count} {c.booking_count === 1 ? "booking" : "bookings"}{c.outstanding_cents ? ` · ${usd(c.outstanding_cents)} due` : ""}</span>
      </Link></li>)}</ul>
    </>}
    <Pagination page={page} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => hrefWith("/admin/clients", params, { page: String(p) })} />
  </>;
}
