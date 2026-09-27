// Studio shooting hours, every day of the week, in the studio time zone.
// A shoot must start and finish inside this window. Busy time, existing bookings and
// days off are removed by Cal from the connected Google Calendar, not here.
export const STUDIO_TIME_ZONE = "America/New_York";
export const STUDIO_HOURS = { open: 8 * 60, close: 24 * 60 }; // minutes after midnight: 8:00 AM – 12:00 AM
export const STUDIO_HOURS_LABEL = "8 AM – midnight on studio days";
// Shoot days alternate week by week (0 = Sunday … 6 = Saturday; weeks run Monday–Sunday).
// The week starting STUDIO_ROTATION_START uses the first pattern, the next week the second, and so on.
export const STUDIO_ROTATION_START = "2026-09-21";
export const STUDIO_WEEK_PATTERNS = [
  [2, 3, 6], // 3-day week: Tuesday, Wednesday, Saturday
  [1, 3, 4, 5], // 4-day week: Monday, Wednesday, Thursday, Friday
];
export function isStudioDayOff(day: string) {
  const date = new Date(`${day}T12:00:00Z`);
  const weekday = date.getUTCDay();
  const monday = date.getTime() - ((weekday + 6) % 7) * 86400000;
  const weeks = Math.round((monday - Date.parse(`${STUDIO_ROTATION_START}T12:00:00Z`)) / (7 * 86400000));
  const pattern = STUDIO_WEEK_PATTERNS[((weeks % STUDIO_WEEK_PATTERNS.length) + STUDIO_WEEK_PATTERNS.length) % STUDIO_WEEK_PATTERNS.length];
  return !pattern.includes(weekday);
}

// The day is split into blocks with one shoot per block; a shoot must fit inside a single block.
export const STUDIO_BLOCKS = [
  { name: "Morning", start: 8 * 60, end: 12 * 60 },
  { name: "Afternoon", start: 12 * 60, end: 18 * 60 },
  { name: "Night", start: 18 * 60, end: 24 * 60 },
] as const;
export type StudioBlock = (typeof STUDIO_BLOCKS)[number];

const clock = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TIME_ZONE, hourCycle: "h23", hour: "2-digit", minute: "2-digit" });
function minuteOfDay(time: number) {
  const parts = Object.fromEntries(clock.formatToParts(new Date(time)).map((p) => [p.type, p.value]));
  return Number(parts.hour) * 60 + Number(parts.minute);
}

export function studioBlockFor(start: string, minutes: number): StudioBlock | undefined {
  const time = Date.parse(start);
  if (!Number.isFinite(time)) return undefined;
  const begins = minuteOfDay(time);
  return STUDIO_BLOCKS.find((b) => begins >= b.start && begins + minutes <= b.end);
}

export function withinStudioHours(start: string, minutes: number) {
  return studioBlockFor(start, minutes) !== undefined;
}

// A block with any booking in it is taken, even if the booking only covers part of it.
export function blockIsFree(start: string, minutes: number, bookings: { start: string; end: string }[]) {
  const block = studioBlockFor(start, minutes);
  if (!block) return false;
  const day = studioDate(start);
  return bookings.every((b) => {
    const from = Date.parse(b.start), to = Date.parse(b.end);
    if (!Number.isFinite(from) || !Number.isFinite(to)) return true;
    // Clamp to this studio day so overnight bookings still count against the right blocks.
    const startsToday = studioDate(b.start) === day, endsToday = studioDate(b.end) === day;
    if (!startsToday && !endsToday) return true;
    const bStart = startsToday ? minuteOfDay(from) : 0;
    const bEnd = endsToday ? minuteOfDay(to) : 24 * 60;
    return bEnd <= block.start || bStart >= block.end;
  });
}

// Example start times for the preview calendar only; live mode uses Cal's slots.
export function studioStartTimes(date: string, minutes: number, stepMinutes = 120) {
  const offset = new Intl.DateTimeFormat("en-US", { timeZone: STUDIO_TIME_ZONE, timeZoneName: "longOffset" })
    .formatToParts(new Date(`${date}T12:00:00Z`)).find((p) => p.type === "timeZoneName")?.value.replace("GMT", "") || "+00:00";
  const starts: { start: string }[] = [];
  for (const block of STUDIO_BLOCKS) for (let m = block.start; m + minutes <= block.end; m += stepMinutes) {
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

// Most shooting time that can be booked on one day, across every package.
export const DAILY_SHOOT_LIMIT_MINUTES = 8 * 60;

const studioDay = new Intl.DateTimeFormat("en-CA", { timeZone: STUDIO_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" });
export const studioDate = (iso: string) => studioDay.format(new Date(iso));

// Minutes already booked per studio day (YYYY-MM-DD), from existing bookings.
export function bookedMinutesByDay(bookings: { start: string; end: string }[]) {
  const totals: Record<string, number> = {};
  for (const { start, end } of bookings) {
    const minutes = (Date.parse(end) - Date.parse(start)) / 60000;
    if (!Number.isFinite(minutes) || minutes <= 0) continue;
    const day = studioDate(start);
    totals[day] = (totals[day] || 0) + minutes;
  }
  return totals;
}

export function fitsDailyLimit(bookedMinutes: number, minutes: number) {
  return bookedMinutes + minutes <= DAILY_SHOOT_LIMIT_MINUTES;
}

// Minimum break between the end of one shoot and the start of the next.
export const SHOOT_BUFFER_MINUTES = 2 * 60;

export function clearOfOtherShoots(start: string, minutes: number, bookings: { start: string; end: string }[]) {
  const begins = Date.parse(start), ends = begins + minutes * 60000, gap = SHOOT_BUFFER_MINUTES * 60000;
  return bookings.every((b) => begins >= Date.parse(b.end) + gap || ends + gap <= Date.parse(b.start));
}
