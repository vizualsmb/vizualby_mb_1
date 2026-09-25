// Studio shooting hours, every day of the week, in the studio time zone.
// A shoot must start and finish inside this window. Busy time, existing bookings and
// days off are removed by Cal from the connected Google Calendar, not here.
export const STUDIO_TIME_ZONE = "America/New_York";
export const STUDIO_HOURS = { open: 6 * 60, close: 24 * 60 }; // minutes after midnight: 6:00 AM – 12:00 AM
export const STUDIO_HOURS_LABEL = "6 AM – midnight, 7 days a week";

const clock = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TIME_ZONE, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });

export function withinStudioHours(start: string, minutes: number) {
  const time = Date.parse(start);
  if (!Number.isFinite(time)) return false;
  const parts = Object.fromEntries(clock.formatToParts(new Date(time)).map((p) => [p.type, p.value]));
  const startMinute = Number(parts.hour) * 60 + Number(parts.minute);
  return startMinute >= STUDIO_HOURS.open && startMinute + minutes <= STUDIO_HOURS.close;
}

// Example start times for the preview calendar only; live mode uses Cal's slots.
export function studioStartTimes(date: string, minutes: number, stepMinutes = 120) {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  const starts: { start: string }[] = [];
  for (let m = STUDIO_HOURS.open; m + minutes <= STUDIO_HOURS.close; m += stepMinutes) {
    starts.push({ start: `${date}T${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}:00${offset}` });
  }
  return starts;
}

const timeOfDay = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: STUDIO_TIME_ZONE });
// "10:00 AM – 1:00 PM": the full shoot window for a package's reserved duration.
export function shootWindow(start: string, minutes: number) {
  const begins = new Date(start);
  return `${timeOfDay.format(begins)} – ${timeOfDay.format(new Date(begins.getTime() + minutes * 60000))}`;
}
