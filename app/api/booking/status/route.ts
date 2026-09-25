import { NextRequest, NextResponse } from "next/server";
import { bookingStore, SESSION_COOKIE, RECEIPT_TTL, type BookingSession, type PaidReceipt, type StripeReceipt } from "@/lib/booking/store";
import { paymentMatches } from "@/lib/booking/verification";
import { currentBooking } from "@/lib/booking/scheduler";
import { type BookingRecord } from "@/lib/booking/reconcile";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
  const uid = request.nextUrl.searchParams.get("uid") || "";
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token) || !/^[\w-]{6,100}$/.test(uid)) return NextResponse.json({ error: "Open this booking from the browser you used to book, or use your confirmation email." }, { status: 401, headers });
  try {
    const store = bookingStore();
    const rateKey = `booking:status-rate:${token}:${Math.floor(Date.now() / 60000)}`;
    const count = await store.incr(rateKey); if (count === 1) await store.expire(rateKey, 90);
    if (count > 30) return NextResponse.json({ error: "Please wait a moment before checking again." }, { status: 429, headers });
    const session = await store.get<BookingSession>(`booking:session:${token}`);
    if (!session) return NextResponse.json({ error: "Your secure session has expired. Please use your confirmation email." }, { status: 401, headers });
    const key = `booking:cal:${uid}`;
    const existing = await store.get<BookingRecord>(`booking:record:${uid}`);
    if (existing && existing.reference !== session.reference) return NextResponse.json({ error: "This booking belongs to a different booking session. Please use your confirmation email." }, { status: 403, headers });
    if (!existing) return NextResponse.json({ state: "verifying" }, { headers });
    const paid = await store.hget<PaidReceipt>(key, "paid");
    if (!paid || !paid.emails.includes(session.intake.email) || paid.eventTypeId !== session.eventTypeId) return NextResponse.json({ state: "awaiting_payment" }, { headers });
    const payment = await store.get<StripeReceipt>(`booking:stripe:${paid.stripePaymentIntentId}`);
    if (!payment) return NextResponse.json({ state: "verifying" }, { headers });
    if (payment.refunded > 0) return NextResponse.json({ state: "refunded" }, { headers });
    if (!paymentMatches(session, paid, payment)) return NextResponse.json({ state: "needs_review" }, { headers });
    const nextUid = await store.hget<string>(key, "nextUid");
    if (nextUid) return NextResponse.json({ state: "rescheduled", nextUid }, { headers });
    const booking = await currentBooking(uid);
    if (booking.eventType.id !== session.eventTypeId || !booking.attendees.some((a) => a.email.toLowerCase() === session.intake.email)) return NextResponse.json({ state: "needs_review" }, { headers });
    if (booking.status !== "accepted") return NextResponse.json({ state: booking.status === "cancelled" ? "cancelled" : "paid_deposit" }, { headers });
    const record = { ...session, uid, stripePaymentIntentId: payment.id, state: "confirmed", start: booking.start, end: booking.end };
    await store.set(`booking:record:${uid}`, record, { ex: RECEIPT_TTL });
    return NextResponse.json({ state: "confirmed", uid, name: session.intake.name, packageName: session.packageName, total: session.total, paymentOption: session.paymentOption ?? "deposit", paid: session.dueNow ?? session.deposit, balance: session.balance, start: booking.start, end: booking.end }, { headers });
  } catch { return NextResponse.json({ error: "We’re still verifying your booking. Please check your confirmation email before trying to book again." }, { status: 503, headers }); }
}
