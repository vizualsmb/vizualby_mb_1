import type { Metadata } from "next";
import Link from "next/link";
import { Columns3, Plus } from "lucide-react";
import s from "@/components/admin/admin.module.css";
import { Chips, PageHeader, Pagination, SearchForm, hrefWith, pageNumber } from "@/components/admin/ui";
import { BookingTable } from "@/components/admin/bookings";
import { requireAdmin } from "@/lib/admin/auth";
import { BOOKING_FILTERS, PAGE_SIZE, listBookings } from "@/lib/admin/queries";
import { statusLabel } from "@/lib/admin/labels";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const filter = BOOKING_FILTERS.some(([k]) => k === params.filter) ? params.filter! : "all";
  const page = pageNumber(params.page);
  const { rows, total } = await listBookings(supabase, { filter, status: params.status, q: params.q, page });

  return <>
    <PageHeader eyebrow="Pipeline" title="Bookings" subtitle={params.status ? `Showing “${statusLabel(params.status)}” only.` : undefined}>
      <Link href="/admin/bookings/board" className={`${s.button} ${s.buttonGhost}`}><Columns3 size={16} aria-hidden />Board</Link>
      <Link href="/admin/bookings/new" className={s.button}><Plus size={16} aria-hidden />New booking</Link>
    </PageHeader>
    <div className={s.toolbar}>
      <Chips label="Filter bookings" items={BOOKING_FILTERS} current={filter} hrefFor={(k) => hrefWith("/admin/bookings", { q: params.q }, { filter: k === "all" ? undefined : k })} />
      <SearchForm action="/admin/bookings" q={params.q} hidden={{ filter: params.filter }} placeholder="Name, email, phone, project, ID" />
    </div>
    <BookingTable rows={rows} />
    <Pagination page={page} total={total} pageSize={PAGE_SIZE} hrefFor={(p) => hrefWith("/admin/bookings", params, { page: String(p) })} />
  </>;
}
