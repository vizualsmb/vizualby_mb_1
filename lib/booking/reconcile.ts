import { bookingStore, RECEIPT_TTL, type BookingSession, type PaidReceipt, type StripeReceipt } from "./store";
import { paymentMatches } from "./verification";
import { currentBooking } from "./scheduler";

export type BookingRecord = BookingSession & { uid: string; state: string; start: string; end: string; stripePaymentIntentId?: string };
// Called from either provider webhook. Browser redirects are never needed for fulfillment.
export async function reconcileBooking(uid: string) {
  const store = bookingStore();
  const record = await store.get<BookingRecord>(`booking:record:${uid}`);
  if (!record) return null;
  const paid = await store.hget<PaidReceipt>(`booking:cal:${uid}`, "paid");
  if (!paid) return record;
  const payment = await store.get<StripeReceipt>(`booking:stripe:${paid.stripePaymentIntentId}`);
  if (!payment) return record;
  const booking = await currentBooking(uid);
  const identityMatches = booking.eventType.id === record.eventTypeId && booking.attendees.some((a) => a.email.toLowerCase() === record.intake.email);
  const nextUid = await store.hget<string>(`booking:cal:${uid}`, "nextUid");
  const state = nextUid ? "rescheduled" : booking.status === "cancelled" ? "cancelled" : payment.refunded > 0 ? "refunded" :
    !identityMatches || !paymentMatches(record, paid, payment) ? "needs_review" : booking.status === "accepted" ? "confirmed" : "paid_deposit";
  const updated = { ...record, state, start: booking.start, end: booking.end, stripePaymentIntentId: payment.id };
  await store.set(`booking:record:${uid}`, updated, { ex: RECEIPT_TTL });
  return updated;
}
