import { randomBytes, randomUUID, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { bookingEnabled, bookingPolicies, calEvents } from "@/lib/booking/config";
import { intakeSchema } from "@/lib/booking/schema";
import { quoteFor, money } from "@/data/booking";
import { availableSlots, validateSchedulingEvent } from "@/lib/booking/scheduler";
import { bookingStore, SESSION_COOKIE, SESSION_TTL, type BookingSession } from "@/lib/booking/store";
import { boundedBody } from "@/lib/booking/security";

export async function POST(request: NextRequest) {
  if (!bookingEnabled()) return NextResponse.json({ error: "Online booking is not open yet. Please contact the studio." }, { status: 503 });
  if (request.headers.get("origin") !== new URL(request.url).origin) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  try {
    const store = bookingStore();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const rateKey = `booking:rate:${createHash("sha256").update(ip).digest("hex")}:${Math.floor(Date.now() / 600000)}`;
    const count = await store.incr(rateKey); if (count === 1) await store.expire(rateKey, 660);
    if (count > 15) return NextResponse.json({ error: "Please wait a few minutes before trying again." }, { status: 429 });
    const parsed = intakeSchema.safeParse(JSON.parse(await boundedBody(request, 12000)));
    if (!parsed.success) return NextResponse.json({ error: "Please check your details and accept the booking terms." }, { status: 400 });
    const intake = parsed.data;
    const quote = quoteFor(intake.packageId, intake.addonIds, intake.paymentOption);
    const mapping = calEvents()[intake.packageId];
    const event = intake.paymentOption === "full" ? mapping?.full : mapping;
    if (mapping && !event) return NextResponse.json({ error: "Paying in full isn’t available for this package yet. Please choose the deposit." }, { status: 400 });
    if (!event) return NextResponse.json({ error: "This package is not available for online booking yet." }, { status: 503 });
    // Read the actual Cal configuration on every new checkout. Never trust browser prices.
    if (!await validateSchedulingEvent(event, quote.dueNow, quote.pkg.minutes)) {
      return NextResponse.json({ error: "This package needs a scheduling update. Please contact the studio." }, { status: 503 });
    }
    const slotTime = Date.parse(intake.selectedSlot);
    if (slotTime <= Date.now() || slotTime > Date.now() + 366 * 86400000) return NextResponse.json({ error: "Please choose a future available date." }, { status: 400 });
    const slotDay = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(slotTime));
    const slots = await availableSlots(event.eventTypeId, new Date(slotTime - 86400000).toISOString(), new Date(slotTime + 86400000).toISOString(), quote.pkg.minutes);
    if (!Object.values(slots).flat().some((s) => Date.parse(s.start) === slotTime)) return NextResponse.json({ error: "That time is no longer available. Please go back and choose another date.", code: "SLOT_UNAVAILABLE" }, { status: 409 });
    const existingToken = request.cookies.get(SESSION_COOKIE)?.value;
    const prior = existingToken && /^[a-f0-9]{64}$/.test(existingToken) ? await store.get<BookingSession>(`booking:session:${existingToken}`) : null;
    const policy = bookingPolicies();
    const reuse = prior && JSON.stringify(prior.intake) === JSON.stringify(intake) && prior.policyVersion === policy.version && prior.total === quote.total && prior.dueNow === quote.dueNow && prior.eventTypeId === event.eventTypeId;
    const token = reuse ? existingToken! : randomBytes(32).toString("hex");
    const session: BookingSession = reuse ? prior : { reference: randomUUID(), packageName: quote.pkg.name, intake, total: quote.total, deposit: quote.deposit, paymentOption: quote.paymentOption, dueNow: quote.dueNow, balance: quote.balance, eventTypeId: event.eventTypeId, policyVersion: policy.version, acceptedAt: new Date().toISOString() };
    await store.set(`booking:session:${token}`, session, { ex: SESSION_TTL });
    await store.set(`booking:draft:${session.reference}`, session, { ex: SESSION_TTL });
    const notes = [`MB reference: ${session.reference}`, quote.pkg.name, `Project total: ${money(quote.total)} | ${quote.paymentOption === "full" ? "Paid in full" : "Deposit"}: ${money(quote.dueNow)} | Balance: ${money(quote.balance)}`, `Add-ons: ${quote.addons.map((a) => a.name).join(", ") || "None"}`, `Company: ${intake.company || "—"}`, `Phone: ${intake.phone}`, intake.project, `Social: ${intake.social || "—"}`, `References: ${intake.references || "—"}`, `Preferred date: ${intake.preferredDate || "Flexible"}; alternative: ${intake.alternativeDate || "Flexible"}`, `Referral: ${intake.referral || "—"}`, `Terms accepted: ${policy.version} at ${session.acceptedAt}`].join("\n");
    const result = NextResponse.json({ calLink: event.calLink, config: { name: intake.name, email: intake.email, notes, date: slotDay, slot: intake.selectedSlot, "cal.tz": "America/New_York" } });
    result.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL });
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch (error) {
    const badRequest = error instanceof SyntaxError || (error instanceof Error && ["Request too large.", "Choose a valid package and add-ons."].includes(error.message));
    return NextResponse.json({ error: badRequest ? "Please check the booking details." : "Scheduling is temporarily unavailable. Your card has not been charged by this portal." }, { status: badRequest ? 400 : 503 });
  }
}
