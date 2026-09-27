import type { Metadata } from "next";
import { ProductionDashboard } from "@/components/admin/ProductionDashboard";
import { requireAdmin } from "@/lib/admin/auth";
import { dashboardData, listBookings } from "@/lib/admin/queries";
import { projectList } from "@/lib/admin/production";
import { resolveRange } from "@/lib/admin/finance";
import { nyDay } from "@/lib/admin/time";

export const metadata: Metadata = { title: "Production OS" };

export default async function Dashboard({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const params = await searchParams;
  const { supabase } = await requireAdmin();
  const range = resolveRange(params.range, nyDay(new Date()), params);
  const [data, editing, projectRows] = await Promise.all([dashboardData(supabase, range), listBookings(supabase, { filter: "editing" }), projectList(supabase)]);
  return <ProductionDashboard data={data} editing={editing.rows} projectRows={projectRows} range={range} />;
}
