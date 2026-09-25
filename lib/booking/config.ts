import { z } from "zod";

const calEvent = z.object({ eventTypeId: z.number().int().positive(), calLink: z.string().regex(/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_/-]+$/) });
// `full` is an optional second Cal event priced at the full package price, for clients paying in full.
const eventSchema = z.record(z.string(), calEvent.extend({ full: calEvent.optional() }));
export function calEvents() {
  try { return eventSchema.parse(JSON.parse(process.env.CAL_BOOKING_EVENTS || "{}")); } catch { return {}; }
}
export function calEventTypeIds() {
  return Object.values(calEvents()).flatMap((e) => e.full ? [e.eventTypeId, e.full.eventTypeId] : [e.eventTypeId]);
}
export const bookingPolicies = () => ({
  version: process.env.BOOKING_POLICY_VERSION || "draft-1",
  cancellation: process.env.BOOKING_CANCELLATION_POLICY || "Cancellation and deposit refund terms will be published before bookings open.",
  rescheduling: process.env.BOOKING_RESCHEDULING_POLICY || "Rescheduling notice and date-change terms will be published before bookings open.",
  balance: process.env.BOOKING_BALANCE_POLICY || "The remaining balance, including selected add-ons, is invoiced separately. Payment timing will be agreed before booking.",
});
export function bookingEnabled() {
  const redisUrl = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return process.env.BOOKING_ENABLED === "true" && process.env.BOOKING_CATALOG_APPROVED === "true" &&
    !!process.env.CAL_API_KEY && !!process.env.CAL_WEBHOOK_SECRET &&
    !!process.env.STRIPE_SECRET_KEY && !!process.env.STRIPE_WEBHOOK_SECRET &&
    !!redisUrl && !!redisToken &&
    !!process.env.BOOKING_CANCELLATION_POLICY && !!process.env.BOOKING_RESCHEDULING_POLICY &&
    !!process.env.BOOKING_BALANCE_POLICY && !!process.env.BOOKING_POLICY_VERSION && Object.keys(calEvents()).length > 0;
}
