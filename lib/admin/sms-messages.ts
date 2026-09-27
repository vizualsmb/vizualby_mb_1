import { formatFullDate, formatTime } from "./time";

type BookingSms = { client_name: string; project: string; shoot_start: string | null; location: string | null };
const firstName = (name: string) => name.trim().split(/\s+/)[0] || "there";
const clean = (value: string, max: number) => value.replace(/[\r\n]+/g, " ").trim().slice(0, max);

export function bookingConfirmationSms(booking: BookingSms, studioName: string) {
  const date = formatFullDate(booking.shoot_start);
  const time = formatTime(booking.shoot_start);
  return `Hi ${clean(firstName(booking.client_name), 40)} — your ${clean(booking.project, 70)} booking with ${clean(studioName, 60)} is confirmed for ${date} at ${time}${booking.location ? ` in ${clean(booking.location, 80)}` : ""}. We’ll follow up with next steps. Reply to this message if you need help.`;
}

export function bookingReminderSms(booking: BookingSms, studioName: string) {
  const date = formatFullDate(booking.shoot_start);
  const time = formatTime(booking.shoot_start);
  return `Reminder from ${clean(studioName, 60)}: your ${clean(booking.project, 70)} shoot is tomorrow at ${time} (${date})${booking.location ? ` in ${clean(booking.location, 80)}` : ""}. Reply if anything has changed.`;
}
