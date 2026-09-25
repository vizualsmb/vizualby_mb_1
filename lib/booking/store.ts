import { Redis } from "@upstash/redis";
import type { Intake } from "./schema";

export const SESSION_TTL = 7 * 24 * 60 * 60;
export const RECEIPT_TTL = 365 * 24 * 60 * 60;
export const SESSION_COOKIE = "mb-booking-session";
export function bookingStore() {
  // Vercel's Upstash integration exposes KV_REST_API_* variables. Keep
  // support for the explicit UPSTASH_REDIS_REST_* names used by .env.example
  // while accepting the managed integration without copying secrets.
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) throw new Error("Booking storage is not configured");
  return new Redis({ url, token });
}
export type BookingSession = { reference: string; packageName: string; intake: Intake; total: number; deposit: number; paymentOption?: "deposit" | "full"; dueNow?: number; balance: number; eventTypeId: number; policyVersion: string; acceptedAt: string };
export type PaidReceipt = { eventTypeId: number; emails: string[]; price: number; currency: string; paymentId: number; stripePaymentIntentId: string };
export type Lifecycle = { state: string; start: string; end: string; updatedAt: string; nextUid?: string };
export type StripeReceipt = { id: string; amount: number; currency: string; refunded: number; status: string; updatedAt: number };
