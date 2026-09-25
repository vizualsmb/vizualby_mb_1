import type { BookingSession, PaidReceipt, StripeReceipt } from "./store";

export function paymentMatches(session: BookingSession, cal: PaidReceipt, stripe: StripeReceipt) {
  const charged = session.dueNow ?? session.deposit;
  return cal.eventTypeId === session.eventTypeId && cal.emails.includes(session.intake.email) &&
    cal.price === charged && cal.currency.toLowerCase() === "usd" &&
    cal.stripePaymentIntentId === stripe.id && stripe.status === "succeeded" &&
    stripe.currency === "usd" && stripe.amount === charged && stripe.refunded === 0;
}
