import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import Stripe from "stripe";
import { quoteFor } from "../data/booking";
import { intakeSchema } from "../lib/booking/schema";
import { validCalSignature, boundedBody } from "../lib/booking/security";
import { paymentMatches } from "../lib/booking/verification";
import { studioStartTimes, withinStudioHours } from "../lib/booking/hours";
import type { BookingSession, PaidReceipt, StripeReceipt } from "../lib/booking/store";

const intake = { packageId: "content-signature", addonIds: ["vertical-cut"], selectedSlot: "2026-10-08T13:00:00-04:00", paymentOption: "deposit" as const, name: "Jordan Client", email: "jordan@example.com", phone: "6175550100", company: "Studio", location: "Boston, MA", project: "A campaign for our business.", references: "", terms: true as const, website: "" as const };
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
  for (const change of [{ terms: false }, { email: "invalid" }, { selectedSlot: "tomorrow" }, { website: "spam" }, { project: "tiny" }]) assert.equal(intakeSchema.safeParse({ ...intake, ...change }).success, false);
  const parsed = intakeSchema.parse({ ...intake, price: 1, deposit: 1 }); assert.equal("price" in parsed, false); assert.equal("deposit" in parsed, false);
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
test("actual request body limits apply even without Content-Length", async () => {
  assert.equal(await boundedBody(new Request("http://localhost", { method: "POST", body: "ok" }), 2), "ok");
  await assert.rejects(() => boundedBody(new Request("http://localhost", { method: "POST", body: "too large" }), 2));
});
test("shoots must start at or after 6 AM and finish by midnight New York time", () => {
  assert.equal(withinStudioHours("2026-10-08T06:00:00-04:00", 180), true);
  assert.equal(withinStudioHours("2026-10-08T05:30:00-04:00", 180), false);
  assert.equal(withinStudioHours("2026-10-08T21:00:00-04:00", 180), true);
  assert.equal(withinStudioHours("2026-10-08T21:15:00-04:00", 180), false);
  assert.equal(withinStudioHours("2026-10-09T01:00:00Z", 180), true); // 9 PM EDT
  assert.equal(withinStudioHours("2026-12-08T18:00:00-05:00", 360), true);
  assert.equal(withinStudioHours("2026-12-08T18:30:00-05:00", 360), false);
  assert.equal(withinStudioHours("not a date", 60), false);
  const starts = studioStartTimes("2026-12-08", 240).map((s) => s.start);
  assert.equal(starts[0], "2026-12-08T06:00:00-05:00"); assert.equal(starts.at(-1), "2026-12-08T20:00:00-05:00");
  assert.ok(starts.every((s) => withinStudioHours(s, 240)));
});
