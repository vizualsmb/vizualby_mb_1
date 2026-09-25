import { STUDIO_TIME_ZONE, withinStudioHours } from "./hours";

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
  for (const [day, values] of Object.entries(data as Record<string, { start: string }[]>)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Array.isArray(values)) continue;
    slots[day] = values.filter((s) => typeof s.start === "string" && Number.isFinite(Date.parse(s.start)) && withinStudioHours(s.start, minutes)).map((s) => ({ start: s.start }));
  }
  return slots;
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
