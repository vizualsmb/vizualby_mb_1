import { NextResponse } from "next/server";
import { z } from "zod";
import { boundedBody, validCalSignature } from "@/lib/booking/security";
import { bookingStore, RECEIPT_TTL, type PaidReceipt, type BookingSession } from "@/lib/booking/store";
import { reconcileBooking, type BookingRecord } from "@/lib/booking/reconcile";
import { calEventTypeIds } from "@/lib/booking/config";
import { syncBookingToAdmin } from "@/lib/admin/sync";

const eventSchema = z.object({
  triggerEvent: z.string(), createdAt: z.iso.datetime({ offset: true }),
  payload: z.object({
    uid: z.string().regex(/^[\w-]{6,100}$/), eventTypeId: z.number().int(),
    startTime: z.iso.datetime({ offset: true }), endTime: z.iso.datetime({ offset: true }),
    status: z.string(), attendees: z.array(z.object({ email: z.email() })),
    price: z.number().int().optional(), currency: z.string().optional(), paymentId: z.number().optional(),
    metadata: z.object({ externalId: z.string().optional() }).passthrough().optional(),
    additionalNotes: z.string().optional(), responses: z.object({ notes: z.object({ value: z.string().optional() }).optional() }).passthrough().optional(),
    rescheduleUid: z.string().regex(/^[\w-]{6,100}$/).optional(),
  }),
});

export async function POST(request: Request) {
  if (!process.env.CAL_WEBHOOK_SECRET) return new Response("Webhook unavailable", { status: 503 });
  let raw: string;
  try { raw = await boundedBody(request, 250000); } catch { return new Response("Invalid body", { status: 413 }); }
  if (!validCalSignature(raw, request.headers.get("x-cal-signature-256"), process.env.CAL_WEBHOOK_SECRET)) return new Response("Invalid signature", { status: 401 });
  let event;
  try { event = eventSchema.parse(JSON.parse(raw)); } catch { return new Response("Invalid payload", { status: 400 }); }
  const { payload: p, triggerEvent, createdAt } = event;
  if (!calEventTypeIds().includes(p.eventTypeId)) return NextResponse.json({ ignored: true });
  if (!["BOOKING_CREATED", "BOOKING_PAID", "BOOKING_CANCELLED", "BOOKING_RESCHEDULED", "BOOKING_REJECTED", "BOOKING_PAYMENT_INITIATED"].includes(triggerEvent)) return NextResponse.json({ ignored: true });
  try {
    const store = bookingStore();
    const key = `booking:cal:${p.uid}`;
    const notes = p.additionalNotes || p.responses?.notes?.value || "";
    const reference = notes.match(/^MB reference: ([a-f0-9-]{36})/m)?.[1];
    const draft = reference ? await store.get<BookingSession>(`booking:draft:${reference}`) : null;
    if (draft && draft.eventTypeId === p.eventTypeId && p.attendees.some((a) => a.email.toLowerCase() === draft.intake.email)) {
      await store.set(`booking:record:${p.uid}`, { ...draft, uid: p.uid, state: "awaiting_payment", start: p.startTime, end: p.endTime }, { ex: RECEIPT_TTL, nx: true });
    }
    if (triggerEvent === "BOOKING_PAID") {
      if (p.price === undefined || !p.currency || !p.paymentId || !p.metadata?.externalId?.startsWith("pi_")) return new Response("Missing payment reference", { status: 422 });
      const paid: PaidReceipt = { eventTypeId: p.eventTypeId, emails: p.attendees.map((a) => a.email.toLowerCase()), price: p.price, currency: p.currency, paymentId: p.paymentId, stripePaymentIntentId: p.metadata.externalId };
      await store.hsetnx(key, "paid", JSON.stringify(paid));
      await store.sadd(`booking:payment-bookings:${paid.stripePaymentIntentId}`, p.uid);
      await store.expire(`booking:payment-bookings:${paid.stripePaymentIntentId}`, RECEIPT_TTL);
    }
    if (triggerEvent === "BOOKING_RESCHEDULED" && p.rescheduleUid) {
      const paid = await store.hget<PaidReceipt>(`booking:cal:${p.rescheduleUid}`, "paid");
      if (paid && paid.eventTypeId === p.eventTypeId && p.attendees.some((a) => paid.emails.includes(a.email.toLowerCase()))) {
        await store.hsetnx(key, "paid", JSON.stringify(paid));
        await store.sadd(`booking:payment-bookings:${paid.stripePaymentIntentId}`, p.uid);
        const previous = await store.get<BookingRecord>(`booking:record:${p.rescheduleUid}`);
        if (previous) await store.set(`booking:record:${p.uid}`, { ...previous, uid: p.uid, start: p.startTime, end: p.endTime }, { nx: true, ex: RECEIPT_TTL });
      }
      // Keep the old receipt as a pointer to the replacement, never as a second confirmed booking.
      await store.hset(`booking:cal:${p.rescheduleUid}`, { nextUid: p.uid });
    }
    // Atomic ordering makes duplicate and out-of-order deliveries harmless.
    const lifecycle = JSON.stringify({ state: p.status.toLowerCase(), start: p.startTime, end: p.endTime, updatedAt: createdAt });
    await store.eval(`local previous = tonumber(redis.call('HGET', KEYS[1], 'timestamp') or '0')
      if tonumber(ARGV[1]) >= previous then redis.call('HSET', KEYS[1], 'timestamp', ARGV[1], 'lifecycle', ARGV[2]) end
      redis.call('EXPIRE', KEYS[1], ARGV[3]); return 1`, [key], [String(Date.parse(createdAt)), lifecycle, RECEIPT_TTL]);
    await reconcileBooking(p.uid);
    if (p.rescheduleUid) await reconcileBooking(p.rescheduleUid);
    await syncBookingToAdmin(p.uid);
    return NextResponse.json({ received: true });
  } catch { return new Response("Temporary storage failure", { status: 503 }); }
}
