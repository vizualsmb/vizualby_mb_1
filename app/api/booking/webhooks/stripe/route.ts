import Stripe from "stripe";
import { boundedBody } from "@/lib/booking/security";
import { bookingStore, RECEIPT_TTL, type StripeReceipt } from "@/lib/booking/store";
import { reconcileBooking } from "@/lib/booking/reconcile";
import { syncBookingToAdmin, syncLinkedStripePayment } from "@/lib/admin/sync";

export async function POST(request: Request) {
  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET) return new Response("Webhook unavailable", { status: 503 });
  const stripe = new Stripe(STRIPE_SECRET_KEY);
  let event: Stripe.Event;
  try { event = stripe.webhooks.constructEvent(await boundedBody(request, 250000), request.headers.get("stripe-signature") || "", STRIPE_WEBHOOK_SECRET); }
  catch { return new Response("Invalid signature or payload", { status: 400 }); }
  if (event.livemode !== (process.env.BOOKING_STRIPE_LIVE === "true")) return new Response("Wrong payment mode", { status: 400 });
  if (event.account && event.account !== process.env.STRIPE_CONNECTED_ACCOUNT_ID) return new Response("Unexpected account", { status: 400 });
  const supported = ["payment_intent.succeeded", "payment_intent.payment_failed", "payment_intent.canceled", "charge.refunded"];
  if (!supported.includes(event.type)) return Response.json({ ignored: true });
  try {
    const object = event.data.object as Stripe.PaymentIntent | Stripe.Charge;
    const id = object.object === "charge" ? (typeof object.payment_intent === "string" ? object.payment_intent : object.payment_intent?.id) : object.id;
    if (!id) return Response.json({ ignored: true });
    const receipt = await currentPayment(stripe, event, object, id);
    const store = bookingStore();
    // Refund amount is monotonic; failed/cancelled events never overwrite a captured payment.
    await store.eval(`local oldRaw = redis.call('GET', KEYS[1]); local incoming = cjson.decode(ARGV[1])
      if oldRaw then local old = cjson.decode(oldRaw)
        if old.refunded > incoming.refunded then incoming.refunded = old.refunded end
        if old.status == 'succeeded' then incoming.status = 'succeeded' end
      end
      redis.call('SET', KEYS[1], cjson.encode(incoming), 'EX', ARGV[2]); return 1`, [`booking:stripe:${id}`], [JSON.stringify({ id, amount: receipt.amount, currency: receipt.currency, refunded: receipt.refunded, status: receipt.status, updatedAt: event.created }), RECEIPT_TTL]);
    // Balance paid through an admin payment link: record it against that booking.
    const adminBookingId = receipt.metadata?.admin_booking_id;
    if (adminBookingId) {
      const merged = await store.get<StripeReceipt>(`booking:stripe:${id}`);
      if (merged) await syncLinkedStripePayment(adminBookingId, merged, receipt.metadata?.admin_payment_type === "partial" ? "partial" : "final");
    }
    const bookingUids = await store.smembers<string[]>(`booking:payment-bookings:${id}`);
    for (const uid of bookingUids) { await reconcileBooking(uid); await syncBookingToAdmin(uid); }
    return Response.json({ received: true });
  } catch (error) {
    // Log the cause (no card or customer data) so a stuck payment can be diagnosed.
    console.error("stripe webhook failed", { event: event.id, type: event.type, error: describe(error) });
    return new Response("Temporary verification failure", { status: 503 });
  }
}

const describe = (error: unknown) => error instanceof Stripe.errors.StripeError
  ? { type: error.type, code: error.code, status: error.statusCode, message: error.message }
  : error instanceof Error ? { message: error.message } : { message: String(error) };

type CurrentPayment = { amount: number; currency: string; refunded: number; status: string; metadata: Stripe.Metadata | null };

// Prefer Stripe's current state, so a delayed event can never resurrect a refunded
// payment. If this key cannot read the PaymentIntent (for example a key or
// connected-account mismatch), fall back to the signed event itself: it was
// verified above, and the Redis merge keeps refunds and success monotonic.
async function currentPayment(stripe: Stripe, event: Stripe.Event, object: Stripe.PaymentIntent | Stripe.Charge, id: string): Promise<CurrentPayment> {
  const attempts = event.account ? [{ stripeAccount: event.account }, undefined] : [undefined];
  for (const options of attempts) {
    try {
      const payment = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] }, options);
      const charge = typeof payment.latest_charge === "object" ? payment.latest_charge : null;
      return { amount: payment.amount_received, currency: payment.currency, refunded: charge?.amount_refunded || 0, status: payment.status, metadata: payment.metadata };
    } catch (error) {
      console.error("stripe webhook: PaymentIntent lookup failed, using the signed event", { event: event.id, account: options?.stripeAccount ?? "own", error: describe(error) });
    }
  }
  if (object.object === "charge") {
    return { amount: object.amount_captured, currency: object.currency, refunded: object.amount_refunded, status: object.captured && object.status === "succeeded" ? "succeeded" : object.status, metadata: object.metadata };
  }
  return { amount: object.amount_received, currency: object.currency, refunded: 0, status: object.status, metadata: object.metadata };
}
