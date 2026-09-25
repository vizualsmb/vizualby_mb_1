import { test } from "node:test";
import assert from "node:assert/strict";
import { leadSourceFrom } from "../lib/admin/labels";
import { adminNewBooking, balanceReminder, shootReminder, type MessageBooking } from "../lib/admin/messages";

test("booking form answers map to lead sources", () => {
  const cases: [string, string][] = [
    ["Instagram", "instagram"], ["TikTok", "tiktok"], ["YouTube", "youtube"], ["Google search", "google"],
    ["Referral from a friend", "referral"], ["Worked together before", "repeat_client"], ["LinkedIn", "linkedin"],
    ["Other", "other"], ["", "website"],
  ];
  for (const [answer, source] of cases) assert.equal(leadSourceFrom(answer).source, source, answer);
  assert.equal(leadSourceFrom("").detail, null);
});

const booking: MessageBooking = {
  client_name: "John Doe", project: "Music Video", shoot_start: "2026-10-12T19:00:00Z", location: "Boston, MA",
  balance_cents: 55000, due_date: "2026-10-12", payment_link_url: "https://buy.stripe.com/test_123", payment_link_cents: 55000,
};
const studio = { name: "Vizuals by MB", email: "hello@vizualbymb.com" };

test("reminders use New York time, first names and the studio sign-off", () => {
  const m = shootReminder(booking, studio);
  assert.match(m.text, /^Hi John,/);
  assert.match(m.text, /Mon, Oct 12, 2026 at 3:00 PM, at Boston, MA/);
  assert.match(m.text, /Vizuals by MB\nhello@vizualbymb.com$/);
});

test("a payment link is included only when it matches the current balance", () => {
  assert.match(balanceReminder(booking, studio, false).text, /buy\.stripe\.com\/test_123/);
  const stale = balanceReminder({ ...booking, payment_link_cents: 40000 }, studio, false).text;
  assert.doesNotMatch(stale, /buy\.stripe\.com/);
  assert.match(balanceReminder(booking, studio, true).subject, /past due/);
  assert.match(balanceReminder(booking, studio, false).text, /\$550/);
});

test("messages are plain text: client-supplied names are never treated as markup", () => {
  const m = adminNewBooking({ ...booking, client_name: "<script>x</script>" }, "https://admin.vizualbymb.com/admin/bookings/1");
  assert.equal(typeof m.text, "string");
  assert.ok(!("html" in m));
});
