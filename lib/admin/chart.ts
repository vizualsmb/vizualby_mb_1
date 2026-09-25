import type { Bucket, SeriesPoint } from "./finance";
import type { ChartPoint } from "@/components/admin/RevenueChart";
import { addDays } from "./time";

const f = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...o });
const md = f({ month: "short", day: "numeric" }), mon = f({ month: "short" }), monY = f({ month: "long", year: "numeric" }), full = f({ month: "short", day: "numeric", year: "numeric" });
const at = (day: string) => new Date(`${day}T12:00:00Z`);

export function chartPoints(series: SeriesPoint[], bucket: Bucket): ChartPoint[] {
  const spansYears = new Set(series.map((p) => p.from.slice(0, 4))).size > 1;
  return series.map((p) => ({
    revenue: p.revenue, expenses: p.expenses, profit: p.profit,
    label: bucket === "month" ? (spansYears && p.from.endsWith("-01-01") ? p.from.slice(0, 4) : mon.format(at(p.from))) : md.format(at(p.from)),
    longLabel: bucket === "month" ? monY.format(at(p.from)) : bucket === "week" ? `Week of ${full.format(at(p.from))}` : full.format(at(p.from)),
  }));
}
export const weekEnd = (from: string) => addDays(from, 6);
