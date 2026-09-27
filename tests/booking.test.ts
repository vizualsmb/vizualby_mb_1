import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import Stripe from "stripe";
import { quoteFor } from "../data/booking";
import { intakeSchema } from "../lib/booking/schema";
import { normalizePhone } from "../lib/booking/phone";
import { validCalSignature, boundedBody } from "../lib/booking/security";
import { paymentMatches } from "../lib/booking/verification";
import { blockIsFree, isStudioDayOff, bookedMinutesByDay, clearOfOtherShoots, fitsDailyLimit, studioBlockFor, studioStartTimes, withinStudioHours } from "../lib/booking/hours";
import type { BookingSession, PaidReceipt, StripeReceipt } from "../lib/booking/store";
import type { PublicPromotion } from "../lib/booking/promotions";
import { syncCalPackage } from "../lib/booking/cal-sync";

const intake = { packageId: "content-signature", addonIds: ["vertical-cut"], promoCode: "", selectedSlot: "2026-10-08T13:00:00-04:00", paymentOption: "deposit" as const, name: "Jordan Client", email: "jordan@example.com", phone: "6175550100", company: "Studio", location: "Boston, MA", project: "A campaign for our business.", references: "", terms: true as const, website: "" as const };
test("quotes use trusted integer cents and reject unknown/duplicate options", () => {
  const q = quoteFor(intake.packageId, intake.addonIds); assert.equal(q.total, 97500); assert.equal(q.deposit, 42500); assert.equal(q.balance, 55000);
  assert.throws(() => quoteFor("cheap-forged-package", []));
  assert.throws(() => quoteFor("content-signature", ["vertical-cut", "vertical-cut"]));
  assert.throws(() => quoteFor("content-signature", ["forged-discount"]));
  assert.throws(() => quoteFor("custom-production", []));
});
test("owner music prices, fixed deposit, and scope boundaries", () => {
  const run = quoteFor("music-run-and-gun", []);
  assert.equal(run.total, 50000); assert.equal(run.deposit, 25000); assert.equal(run.balance, 25000); assert.equal(run.pkg.minutes, 120);
  const creative = quoteFor("music-creative", ["music-concept"]);
  assert.equal(creative.total, 87500); assert.equal(creative.deposit, 40000); assert.equal(creative.balance, 47500); assert.equal(creative.pkg.minutes, 240);
  const fullConcept = quoteFor("music-full-concept", []);
  assert.equal(fullConcept.total, 150000); assert.equal(fullConcept.deposit, 75000); assert.equal(fullConcept.balance, 75000);
  assert.throws(() => quoteFor("music-run-and-gun", ["extra-revision"]));
  assert.throws(() => quoteFor("music-creative", ["rush", "additional-hour"]));
  assert.throws(() => quoteFor("content-signature", ["music-concept"]));
});
test("intake requires consent, valid identity and a timestamp, rejects honeypots", () => {
  assert.equal(intakeSchema.safeParse(intake).success, true);
  for (const change of [{ terms: false }, { email: "invalid" }, { phone: "not-a-phone" }, { selectedSlot: "tomorrow" }, { website: "spam" }, { project: "tiny" }]) assert.equal(intakeSchema.safeParse({ ...intake, ...change }).success, false);
  const parsed = intakeSchema.parse({ ...intake, price: 1, deposit: 1 }); assert.equal("price" in parsed, false); assert.equal("deposit" in parsed, false);
  assert.equal(parsed.phone, "+16175550100");
});
test("phone normalization accepts E.164 and local North American input only when unambiguous", () => {
  assert.equal(normalizePhone("(617) 555-0100"), "+16175550100");
  assert.equal(normalizePhone("+44 20 7946 0958"), "+442079460958");
  assert.equal(normalizePhone("020 7946 0958"), null);
});
test("Cal webhook verifies exact raw body with constant-time digest comparison", () => {
  const body = '{"triggerEvent":"BOOKING_PAID"}'; const secret = "test-secret";
  const signature = createHmac("sha256", secret).update(body).digest("hex");
  assert.equal(validCalSignature(body, signature, secret), true);
  assert.equal(validCalSignature(`${body} `, signature, secret), false);
  assert.equal(validCalSignature(body, "x".repeat(64), secret), false);
  assert.equal(validCalSignature(body, null, secret), false);
  assert.equal(validCalSignature(body, signature, "wrong-secret"), false);
});
test("Stripe signature verification rejects spoofed, tampered and stale events", () => {
  const stripe = new Stripe("sk_test_not_a_real_key"); const secret = "whsec_test_only";
  const payload = JSON.stringify({ id: "evt_test", type: "payment_intent.succeeded", data: { object: { id: "pi_test" } } });
  const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });
  assert.equal(stripe.webhooks.constructEvent(payload, signature, secret).id, "evt_test");
  assert.throws(() => stripe.webhooks.constructEvent(`${payload} `, signature, secret));
  assert.throws(() => stripe.webhooks.constructEvent(payload, signature, "wrong"));
  const stale = stripe.webhooks.generateTestHeaderString({ payload, secret, timestamp: 1 });
  assert.throws(() => stripe.webhooks.constructEvent(payload, stale, secret));
});
test("confirmation needs matching Stripe and Cal payment facts, including zero refunds", () => {
  const session: BookingSession = { reference: "ref", packageName: "The Signature", intake, total: 97500, deposit: 25000, balance: 72500, eventTypeId: 123, policyVersion: "v1", acceptedAt: "2026-09-23" };
  const cal: PaidReceipt = { eventTypeId: 123, emails: [intake.email], price: 25000, currency: "USD", paymentId: 5, stripePaymentIntentId: "pi_test" };
  const stripe: StripeReceipt = { id: "pi_test", amount: 25000, currency: "usd", refunded: 0, status: "succeeded", updatedAt: 1 };
  assert.equal(paymentMatches(session, cal, stripe), true);
  for (const change of [{ amount: 1 }, { refunded: 1 }, { status: "processing" }, { currency: "eur" }, { id: "pi_other" }]) assert.equal(paymentMatches(session, cal, { ...stripe, ...change }), false);
  for (const change of [{ eventTypeId: 999 }, { emails: ["other@example.com"] }, { price: 1 }]) assert.equal(paymentMatches(session, { ...cal, ...change }, stripe), false);
  // Paying in full: only the full amount confirms; a deposit-sized payment does not.
  const full: BookingSession = { ...session, paymentOption: "full", dueNow: 97500, balance: 0 };
  assert.equal(paymentMatches(full, { ...cal, price: 97500 }, { ...stripe, amount: 97500 }), true);
  assert.equal(paymentMatches(full, cal, stripe), false);
});
test("clients can pay the deposit or the full price", () => {
  const deposit = quoteFor("music-run-and-gun", []);
  assert.equal(deposit.dueNow, 25000); assert.equal(deposit.balance, 25000);
  const full = quoteFor("music-run-and-gun", [], "full");
  assert.equal(full.dueNow, 50000); assert.equal(full.balance, 0); assert.equal(full.deposit, 25000);
  assert.equal(intakeSchema.parse({ ...intake, paymentOption: undefined }).paymentOption, "deposit");
  assert.equal(intakeSchema.safeParse({ ...intake, paymentOption: "half" }).success, false);
  const { location: _, ...noLocation } = intake; void _;
  assert.equal(intakeSchema.safeParse(noLocation).success, true);
});
test("deals recalculate the package deposit from the trusted discounted price", () => {
  const deal: PublicPromotion = { id: "a3f6491f-fd05-4e8d-b2ed-b87bc9d4a2be", packageId: "music-full-concept", originalPrice: 150000, discountedPrice: 120000, discountType: "flat", label: "LIMITED OFFER", startsOn: "2026-09-01", endsOn: "2026-10-15", bookingDeadline: null, limitedQuantity: 3, remainingQuantity: 3, requiresCode: false, valueNote: "+ 2 vertical social edits included" };
  const quote = quoteFor("music-full-concept", [], "deposit", deal);
  assert.equal(quote.originalPrice, 150000); assert.equal(quote.packagePrice, 120000); assert.equal(quote.savings, 30000);
  assert.equal(quote.deposit, 60000); assert.equal(quote.dueNow, 60000); assert.equal(quote.balance, 60000);
  assert.throws(() => quoteFor("music-run-and-gun", [], "deposit", deal));
});
test("admin-managed packages use their own server-side price and deposit percentage", () => {
  const managed = { ...quoteFor("music-run-and-gun", []).pkg, id: "music-performance", name: "Performance Visual", price: 120000, deposit: 36000, depositPercent: 30 };
  const quote = quoteFor(managed.id, [], "deposit", null, [managed]);
  assert.equal(quote.total, 120000); assert.equal(quote.deposit, 36000); assert.equal(quote.balance, 84000);
  assert.throws(() => quoteFor("music-run-and-gun", [], "deposit", null, [managed]));
});
test("admin package sync writes trusted deposit cents to Cal and verifies the result", async () => {
  const priorKey = process.env.CAL_API_KEY;
  const priorFetch = globalThis.fetch;
  process.env.CAL_API_KEY = "cal_test_key";
  let state = {
    title: "Old package",
    lengthInMinutes: 60,
    bookingUrl: "https://cal.com/vizual/booking-test",
    metadata: { apps: { stripe: { enabled: true, paymentOption: "ON_BOOKING", price: 100, currency: "usd", refundPolicy: "NEVER" } } },
  };
  const requests: { url: string; init?: RequestInit }[] = [];
  globalThis.fetch = async (input, init) => {
    const url = String(input); requests.push({ url, init });
    if (init?.method === "PATCH") {
      const body = JSON.parse(String(init.body));
      state = { ...state, title: body.title, lengthInMinutes: body.length, metadata: body.metadata };
      return Response.json({ status: "success", data: state });
    }
    return Response.json({ status: "success", data: state });
  };
  try {
    await syncCalPackage({
      deposit: { event: { eventTypeId: 123, calLink: "vizual/booking-test" }, price: 36000, title: "Performance Visual — Deposit" },
      minutes: 240,
    });
    assert.equal(state.title, "Performance Visual — Deposit");
    assert.equal(state.lengthInMinutes, 240);
    assert.equal(state.metadata.apps.stripe.price, 36000);
    assert.equal(state.metadata.apps.stripe.refundPolicy, "NEVER");
    assert.equal(requests.filter((request) => request.init?.method === "PATCH").length, 1);
    assert.equal(requests.at(-1)?.url, "https://api.cal.com/v2/event-types/123");
  } finally {
    globalThis.fetch = priorFetch;
    if (priorKey === undefined) delete process.env.CAL_API_KEY; else process.env.CAL_API_KEY = priorKey;
  }
});
test("actual request body limits apply even without Content-Length", async () => {
  assert.equal(await boundedBody(new Request("http://localhost", { method: "POST", body: "ok" }), 2), "ok");
  await assert.rejects(() => boundedBody(new Request("http://localhost", { method: "POST", body: "too large" }), 2));
});
test("shoots must start at or after 8 AM and finish by midnight New York time", () => {
  assert.equal(withinStudioHours("2026-10-08T08:00:00-04:00", 180), true);
  assert.equal(withinStudioHours("2026-10-08T07:30:00-04:00", 180), false);
  assert.equal(withinStudioHours("2026-10-08T06:00:00-04:00", 180), false);
  assert.equal(withinStudioHours("2026-10-08T05:30:00-04:00", 180), false);
  assert.equal(withinStudioHours("2026-10-08T21:00:00-04:00", 180), true);
  assert.equal(withinStudioHours("2026-10-08T21:15:00-04:00", 180), false);
  assert.equal(withinStudioHours("2026-10-09T01:00:00Z", 180), true); // 9 PM EDT
  assert.equal(withinStudioHours("2026-12-08T18:00:00-05:00", 360), true);
  assert.equal(withinStudioHours("2026-12-08T18:30:00-05:00", 360), false);
  assert.equal(withinStudioHours("not a date", 60), false);
  const starts = studioStartTimes("2026-12-08", 240).map((s) => s.start);
  assert.equal(starts[0], "2026-12-08T08:00:00-05:00"); assert.equal(starts.at(-1), "2026-12-08T20:00:00-05:00");
  assert.ok(starts.every((s) => withinStudioHours(s, 240)));
});
test("no more than 8 hours of shooting can be booked on one day", () => {
  const booked = bookedMinutesByDay([
    { start: "2026-10-02T14:00:00Z", end: "2026-10-02T18:00:00Z" }, // Creative, 10 AM–2 PM EDT
    { start: "2026-10-02T20:00:00Z", end: "2026-10-02T22:00:00Z" }, // Run & Gun, 4–6 PM EDT
    { start: "2026-10-03T02:00:00Z", end: "2026-10-03T03:00:00Z" }, // 10 PM EDT on Oct 2, not Oct 3
    { start: "bad", end: "2026-10-04T00:00:00Z" },
  ]);
  assert.deepEqual(booked, { "2026-10-02": 420 });
  assert.equal(fitsDailyLimit(booked["2026-10-02"], 60), true);
  assert.equal(fitsDailyLimit(booked["2026-10-02"], 120), false);
  assert.equal(fitsDailyLimit(0, 360), true);
  assert.equal(fitsDailyLimit(240, 240), true);
  assert.equal(fitsDailyLimit(360, 240), false);
});
test("shoots keep at least a 2-hour break from other shoots", () => {
  const booked = [{ start: "2026-10-02T12:00:00-04:00", end: "2026-10-02T14:00:00-04:00" }]; // 12–2 PM
  assert.equal(clearOfOtherShoots("2026-10-02T16:00:00-04:00", 120, booked), true); // starts 2h after
  assert.equal(clearOfOtherShoots("2026-10-02T15:30:00-04:00", 120, booked), false); // only 1.5h after
  assert.equal(clearOfOtherShoots("2026-10-02T08:00:00-04:00", 120, booked), true); // ends 10 AM, 2h before
  assert.equal(clearOfOtherShoots("2026-10-02T08:30:00-04:00", 120, booked), false); // ends 10:30, too close
  assert.equal(clearOfOtherShoots("2026-10-02T13:00:00-04:00", 120, booked), false); // overlaps
  assert.equal(clearOfOtherShoots("2026-10-02T08:00:00-04:00", 120, []), true);
});
test("one shoot per morning, afternoon or night block", () => {
  assert.equal(studioBlockFor("2026-10-02T08:00:00-04:00", 240)?.name, "Morning");
  assert.equal(studioBlockFor("2026-10-02T11:00:00-04:00", 120), undefined); // would cross into the afternoon
  assert.equal(studioBlockFor("2026-10-02T12:00:00-04:00", 360)?.name, "Afternoon");
  assert.equal(studioBlockFor("2026-10-02T08:00:00-04:00", 360), undefined); // Full Concept doesn't fit the morning
  assert.equal(studioBlockFor("2026-10-02T22:00:00-04:00", 120)?.name, "Night");
  const morning = [{ start: "2026-10-02T08:00:00-04:00", end: "2026-10-02T10:00:00-04:00" }];
  assert.equal(blockIsFree("2026-10-02T10:00:00-04:00", 120, morning), false); // morning already taken
  assert.equal(blockIsFree("2026-10-02T14:00:00-04:00", 120, morning), true);
  assert.equal(blockIsFree("2026-10-02T18:00:00-04:00", 120, morning), true);
  assert.equal(blockIsFree("2026-10-03T08:00:00-04:00", 120, morning), true); // other day
  const night = [{ start: "2026-10-02T23:00:00-04:00", end: "2026-10-03T00:00:00-04:00" }]; // ends at midnight
  assert.equal(blockIsFree("2026-10-02T18:00:00-04:00", 120, night), false);
  assert.equal(blockIsFree("2026-10-03T08:00:00-04:00", 120, night), true);
  const starts = studioStartTimes("2026-10-02", 120).map((s) => s.start.slice(11, 16));
  assert.deepEqual(starts, ["08:00", "10:00", "12:00", "14:00", "16:00", "18:00", "20:00", "22:00"]);
});
test("shoot days alternate between a 3-day and a 4-day week", () => {
  const open = (days: string[]) => days.filter((d) => !isStudioDayOff(d));
  // 3-day week of Sep 21: Tue, Wed, Sat
  assert.deepEqual(open(["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]), ["2026-09-22", "2026-09-23", "2026-09-26"]);
  // 4-day week of Sep 28: Mon, Wed, Thu, Fri
  assert.deepEqual(open(["2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]), ["2026-09-28", "2026-09-30", "2026-10-01", "2026-10-02"]);
  // and back again, across month, year and daylight-saving changes
  assert.deepEqual(open(["2026-10-05", "2026-10-06", "2026-10-10"]), ["2026-10-06", "2026-10-10"]);
  assert.equal(isStudioDayOff("2026-11-02"), true); // Monday after DST ends: 3-day week, off
  assert.equal(isStudioDayOff("2026-11-03"), false); // Tuesday, 3-day week
  assert.equal(isStudioDayOff("2027-01-04"), false); // Monday, 4-day week
  assert.equal(isStudioDayOff("2027-01-05"), true); // Tuesday, 4-day week
});
