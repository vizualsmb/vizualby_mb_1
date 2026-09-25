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
    // Fetch current state: webhook arrival order must not resurrect refunded payments.
    const payment = await stripe.paymentIntents.retrieve(id, { expand: ["latest_charge"] }, event.account ? { stripeAccount: event.account } : undefined);
    const charge = typeof payment.latest_charge === "object" ? payment.latest_charge : null;
    const store = bookingStore();
    // Refund amount is monotonic; failed/cancelled events never overwrite a captured payment.
    await store.eval(`local oldRaw = redis.call('GET', KEYS[1]); local incoming = cjson.decode(ARGV[1])
      if oldRaw then local old = cjson.decode(oldRaw)
        if old.refunded > incoming.refunded then incoming.refunded = old.refunded end
        if old.status == 'succeeded' then incoming.status = 'succeeded' end
      end
      redis.call('SET', KEYS[1], cjson.encode(incoming), 'EX', ARGV[2]); return 1`, [`booking:stripe:${id}`], [JSON.stringify({ id, amount: payment.amount_received, currency: payment.currency, refunded: charge?.amount_refunded || 0, status: payment.status, updatedAt: event.created }), RECEIPT_TTL]);
    // Balance paid through an admin payment link: record it against that booking.
    const adminBookingId = payment.metadata?.admin_booking_id;
    if (adminBookingId) {
      const merged = await store.get<StripeReceipt>(`booking:stripe:${id}`);
      if (merged) await syncLinkedStripePayment(adminBookingId, merged, payment.metadata?.admin_payment_type === "partial" ? "partial" : "final");
    }
    const bookingUids = await store.smembers<string[]>(`booking:payment-bookings:${id}`);
    for (const uid of bookingUids) { await reconcileBooking(uid); await syncBookingToAdmin(uid); }
    return Response.json({ received: true });
  } catch { return new Response("Temporary verification failure", { status: 503 }); }
}
