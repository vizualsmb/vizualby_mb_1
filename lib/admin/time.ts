// All business dates are America/New_York calendar days, independent of server time zone.
export const TZ = "America/New_York";

const dayFormat = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
export const nyDay = (d: Date | string) => dayFormat.format(typeof d === "string" ? new Date(d) : d);

function offsetFor(day: string) {
  const name = new Intl.DateTimeFormat("en-US", { timeZone: TZ, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${day}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value;
  return name?.replace("GMT", "") || "+00:00";
}
// The UTC instant at which a New York calendar day begins (DST-aware).
export const startOfNyDay = (day: string) => new Date(`${day}T00:00:00${offsetFor(day)}`);

// "2026-10-12" + "15:00" in New York -> UTC instant.
export const nyInstant = (day: string, time: string) => new Date(`${day}T${time}:00${offsetFor(day)}`);
const timeInputF = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
export const nyTimeInput = (iso: string) => timeInputF.format(new Date(iso));

export function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10);
}
export function addMonths(day: string, n: number) {
  const [y, m] = day.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1)); return d.toISOString().slice(0, 10);
}
export const monthStart = (day: string) => `${day.slice(0, 7)}-01`;
export const yearStart = (day: string) => `${day.slice(0, 4)}-01-01`;

const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-US", { timeZone: TZ, ...o });
const dateF = fmt({ month: "short", day: "numeric", year: "numeric" });
const shortF = fmt({ weekday: "short", month: "short", day: "numeric" });
const fullF = fmt({ weekday: "short", month: "short", day: "numeric", year: "numeric" });
export const formatFullDate = (iso?: string | null) => (iso ? fullF.format(new Date(iso)) : "—");
const timeF = fmt({ hour: "numeric", minute: "2-digit" });
export const formatDate = (iso?: string | null) => (iso ? dateF.format(new Date(iso)) : "—");
export const formatShortDate = (iso?: string | null) => (iso ? shortF.format(new Date(iso)) : "—");
export const formatTime = (iso?: string | null) => (iso ? timeF.format(new Date(iso)) : "");
// A plain YYYY-MM-DD (e.g. a due date) is a calendar day, not an instant.
export const formatDay = (day?: string | null) => (day ? formatDate(`${day}T12:00:00Z`) : "—");
