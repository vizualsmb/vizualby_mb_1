import { STUDIO_TIME_ZONE, blockIsFree, isStudioDayOff, bookedMinutesByDay, clearOfOtherShoots, fitsDailyLimit, studioDate } from "./hours";

// Provider boundary: the UI receives only links/config and never calendar credentials.
export type SchedulingEvent = { eventTypeId: number; calLink: string };
export async function availableSlots(eventTypeId: number, start: string, end: string, minutes: number) {
  const query = new URLSearchParams({ eventTypeId: String(eventTypeId), start, end, timeZone: STUDIO_TIME_ZONE, format: "range" });
  const response = await fetch(`https://api.cal.com/v2/slots?${query}`, {
    headers: { Authorization: `Bearer ${process.env.CAL_API_KEY}`, "cal-api-version": "2024-09-04" }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Availability unavailable");
  const { data } = await response.json();
  // Allowlist fields: never forward raw provider responses or calendar details.
  // Studio hours are enforced here too, so a looser Cal schedule can never open extra times.
  const slots: Record<string, { start: string }[]> = {};
  const bookings = await activeBookings(start, end);
  const booked = bookedMinutesByDay(bookings);
  const firstDay = start.slice(0, 10), lastDay = end.slice(0, 10);
  for (const values of Object.values(data as Record<string, { start: string }[]>)) {
    if (!Array.isArray(values)) continue;
    for (const slot of values) {
      if (typeof slot.start !== "string" || !Number.isFinite(Date.parse(slot.start))) continue;
      // Cal can place midnight-UTC slots under an adjacent date key. Always
      // derive the customer-facing day in the studio timezone and discard the
      // provider's boundary buckets outside the requested range.
      const day = studioDate(slot.start);
      if (day < firstDay || day > lastDay || isStudioDayOff(day)) continue;
      if (!fitsDailyLimit(booked[day] || 0, minutes)) continue;
      if (!blockIsFree(slot.start, minutes, bookings) || !clearOfOtherShoots(slot.start, minutes, bookings)) continue;
      const daySlots = slots[day] ?? (slots[day] = []);
      if (!daySlots.some((candidate) => Date.parse(candidate.start) === Date.parse(slot.start))) daySlots.push({ start: slot.start });
    }
  }
  for (const values of Object.values(slots)) values.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  return slots;
}

// Re-check against the same calendar-month window used to present availability.
// Cal's slots API treats date-only and timestamp ranges differently near timezone
// boundaries, so a narrow +/- 24 hour timestamp query can omit a slot that the
// customer was just shown.
export async function slotIsAvailable(eventTypeId: number, selectedSlot: string, minutes: number) {
  const slotTime = Date.parse(selectedSlot);
  if (!Number.isFinite(slotTime)) return false;
  const day = studioDate(selectedSlot);
  const [year, month] = day.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const slots = await availableSlots(eventTypeId, `${day.slice(0, 7)}-01`, lastDay, minutes);
  return (slots[day] ?? []).some((slot) => Date.parse(slot.start) === slotTime);
}
// Every non-cancelled Cal booking (any event type) overlapping the range, including unpaid holds.
async function activeBookings(start: string, end: string) {
  const bookings: { start: string; end: string }[] = [];
  for (let skip = 0; skip < 1000; skip += 100) {
    const query = new URLSearchParams({ afterStart: new Date(Date.parse(start) - 86400000).toISOString(), beforeEnd: new Date(Date.parse(end) + 2 * 86400000).toISOString(), take: "100", skip: String(skip) });
    const response = await fetch(`https://api.cal.com/v2/bookings?${query}`, {
      headers: { Authorization: `Bearer ${process.env.CAL_API_KEY}`, "cal-api-version": "2024-08-13" }, cache: "no-store", signal: AbortSignal.timeout(10000),
    });
    if (!response.ok) throw new Error("Availability unavailable");
    const { data, pagination } = await response.json() as { data: { start: string; end: string; status: string }[]; pagination?: { hasNextPage?: boolean } };
    for (const b of data) if (!["cancelled", "rejected"].includes(String(b.status).toLowerCase())) bookings.push({ start: b.start, end: b.end });
    if (!pagination?.hasNextPage) break;
  }
  return bookings;
}

export async function validateSchedulingEvent(event: SchedulingEvent, deposit: number, minutes: number) {
  const response = await fetch(`https://api.cal.com/v2/event-types/${event.eventTypeId}`, {
    headers: { Authorization: `Bearer ${process.env.CAL_API_KEY}`, "cal-api-version": "2026-06-12" }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Calendar unavailable");
  const { data } = await response.json();
  const stripe = data.metadata?.apps?.stripe;
  return stripe?.enabled === true && stripe.paymentOption === "ON_BOOKING" &&
    stripe.price === deposit && String(stripe.currency).toLowerCase() === "usd" &&
    data.lengthInMinutes === minutes && data.bookingUrl === `https://cal.com/${event.calLink}` &&
    data.seats?.disabled !== false && !data.seatsPerTimeSlot &&
    (!data.confirmationPolicy || data.confirmationPolicy.disabled === true) &&
    data.emailSettings?.disableEmailsToAttendees !== true && data.emailSettings?.disableEmailsToHosts !== true;
}

export async function currentBooking(uid: string) {
  const response = await fetch(`https://api.cal.com/v2/bookings/${encodeURIComponent(uid)}`, {
    headers: { Authorization: `Bearer ${process.env.CAL_API_KEY}`, "cal-api-version": "2026-02-25" }, cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error("Booking verification unavailable");
  const { data } = await response.json();
  return data as { uid: string; status: string; start: string; end: string; eventType: { id: number }; attendees: { email: string }[] };
}
