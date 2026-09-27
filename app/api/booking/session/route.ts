import { randomBytes, randomUUID, createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { bookingEnabled, bookingPolicies, calEvents } from "@/lib/booking/config";
import { intakeSchema } from "@/lib/booking/schema";
import { quoteFor, money } from "@/data/booking";
import { slotIsAvailable, validateSchedulingEvent } from "@/lib/booking/scheduler";
import { bookingStore, RECEIPT_TTL, SESSION_COOKIE, SESSION_TTL, type BookingSession } from "@/lib/booking/store";
import { boundedBody } from "@/lib/booking/security";
import { resolvePromotion } from "@/lib/booking/promotions.server";
import { checkoutCatalogPackages } from "@/lib/booking/catalog.server";
import { ASSISTANT_DRAFT_COOKIE, draftKey, draftReferenceKey, type AssistantDraft } from "@/lib/assistant/draft";
import { assistantDraftId, logAssistantLifecycle } from "@/lib/assistant/auth";

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
    // Promotions are looked up again immediately before payment. Browser-sent
    // ids and codes can identify an offer, but can never set its price.
    const packages = await checkoutCatalogPackages();
    const promotion = await resolvePromotion(intake.packageId, intake.promoCode);
    if (intake.promotionId && promotion?.id !== intake.promotionId) throw new Error("PROMOTION_UNAVAILABLE");
    const quote = quoteFor(intake.packageId, intake.addonIds, intake.paymentOption, promotion, packages);
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
    if (!await slotIsAvailable(event.eventTypeId, intake.selectedSlot, quote.pkg.minutes)) return NextResponse.json({ error: "That time is no longer available. Please go back and choose another date.", code: "SLOT_UNAVAILABLE" }, { status: 409 });
    const existingToken = request.cookies.get(SESSION_COOKIE)?.value;
    const prior = existingToken && /^[a-f0-9]{64}$/.test(existingToken) ? await store.get<BookingSession>(`booking:session:${existingToken}`) : null;
    const policy = bookingPolicies();
    const reuse = prior && JSON.stringify(prior.intake) === JSON.stringify(intake) && prior.policyVersion === policy.version && prior.total === quote.total && prior.dueNow === quote.dueNow && prior.eventTypeId === event.eventTypeId;
    const token = reuse ? existingToken! : randomBytes(32).toString("hex");
    const assistantToken = request.cookies.get(ASSISTANT_DRAFT_COOKIE)?.value;
    const assistantDraft = assistantToken && /^[a-f0-9]{64}$/.test(assistantToken) ? await store.get<AssistantDraft>(draftKey(assistantToken)) : null;
    const assistantId = assistantToken && assistantDraft ? assistantDraftId(assistantToken) : undefined;
    const session: BookingSession = reuse ? { ...prior, ...(assistantDraft ? { assistantClientId: assistantDraft.clientId, assistantDraftId: assistantId } : {}) } : { reference: randomUUID(), packageName: quote.pkg.name, packageCategory: quote.pkg.category, packageMinutes: quote.pkg.minutes, intake, total: quote.total, originalPrice: quote.originalPrice, packagePrice: quote.packagePrice, promotionId: quote.promotion?.id, savings: quote.savings, deposit: quote.deposit, paymentOption: quote.paymentOption, dueNow: quote.dueNow, balance: quote.balance, eventTypeId: event.eventTypeId, policyVersion: policy.version, acceptedAt: new Date().toISOString(), assistantClientId: assistantDraft?.clientId, assistantDraftId: assistantId };
    await store.set(`booking:session:${token}`, session, { ex: SESSION_TTL });
    await store.set(`booking:draft:${session.reference}`, session, { ex: SESSION_TTL });
    if (assistantToken && assistantDraft) {
      await store.set(draftReferenceKey(assistantToken), { reference: session.reference, clientId: assistantDraft.clientId }, { ex: RECEIPT_TTL });
      logAssistantLifecycle({ clientId: assistantDraft.clientId, event: "checkout.started", draftId: assistantId });
    }
    // Shown to the client in Cal and to the studio on the calendar event: only real, collected details.
    const paidToday = quote.paymentOption === "full" ? `Paid in full: ${money(quote.dueNow)}` : `Deposit today: ${money(quote.dueNow)} · Balance due: ${money(quote.balance)}`;
    const summary = [`${quote.pkg.name} · ${money(quote.total)}`, ...(quote.promotion ? [`Package deal: ${money(quote.packagePrice)} (save ${money(quote.savings)})`] : []), paidToday, ...(quote.addons.length ? [`Add-ons: ${quote.addons.map((a) => a.name).join(", ")}`] : []), `Phone: ${intake.phone}`];
    const notes = [...summary, "", `Vision: ${intake.project}`, "", `Ref: ${session.reference}`].join("\n");
    const result = NextResponse.json({ calLink: event.calLink, config: { name: intake.name, email: intake.email, notes, "metadata[mbReference]": session.reference, date: slotDay, slot: intake.selectedSlot, "cal.tz": "America/New_York" } });
    result.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: SESSION_TTL });
    if (assistantToken && assistantDraft) result.cookies.set(ASSISTANT_DRAFT_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
    result.headers.set("Cache-Control", "no-store");
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "PROMO_CODE_REQUIRED") return NextResponse.json({ error: "That promo code is missing or doesn’t match this package. Please check it and try again.", code: message }, { status: 400 });
    if (message === "PROMOTION_UNAVAILABLE") return NextResponse.json({ error: "This offer is no longer available. Your card has not been charged. Please return to packages to review the current price.", code: message }, { status: 409 });
    const badRequest = error instanceof SyntaxError || ["Request too large.", "Choose a valid package and add-ons."].includes(message);
    return NextResponse.json({ error: badRequest ? "Please check the booking details." : "Scheduling is temporarily unavailable. Your card has not been charged by this portal." }, { status: badRequest ? 400 : 503 });
  }
}
