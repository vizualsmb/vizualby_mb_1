// DEMO DATA for local development only (ADMIN_DEV_BYPASS without a database).
// Fictional clients and amounts, generated relative to today. Never used in production.
import { bookingAddons, bookingPackages } from "@/data/booking";
import { addDays, nyDay, nyInstant } from "../time";

type Row = Record<string, unknown>;
export type DemoTables = Record<"clients" | "bookings" | "booking_addons" | "payments" | "expenses" | "booking_events" | "business_settings" | "audit_logs" | "notifications" | "admins" | "projects" | "project_stages" | "project_tasks" | "project_time_sessions", Row[]>;

const CLIENTS: [string, string | null, string, string][] = [
  ["Jay Rivers", null, "artist", "@jayrivers.music"], ["Kiara Santos", "Santos Studio", "brand", "@kiarasantos"],
  ["Fade Factory Barbershop", "Fade Factory", "barbershop", "@fadefactory"], ["Lumen Café", "Lumen Café", "restaurant", "@lumencafe"],
  ["Dana Pierce", "Nova Realty", "real_estate_agent", ""], ["Marcus Hale", null, "artist", "@marcushale"],
  ["Oceanside Events", "Oceanside Events", "event_client", ""], ["Brick & Bloom Bakery", "Brick & Bloom", "restaurant", "@brickandbloom"],
  ["Tariq James", null, "artist", "@tariqjames"], ["Selene Vega", null, "artist", ""], ["Northshore Fitness", "Northshore Fitness", "business", "@northshorefit"],
  ["Ari Monroe", null, "artist", "@arimonroe"], ["Harbor Line Records", "Harbor Line Records", "agency", ""], ["Maya Chen", null, "brand", ""], ["Eli Brooks", null, "artist", ""],
];

type Pay = [type: string, method: string, amount: "deposit" | "balance" | number, day: number, status?: string, refunded?: number];
type Spec = { c: number; pkg: string; status: string; shoot: number | null; hour?: string; created: number; lead: string; loc?: string; pays: Pay[]; due?: number; adj?: number; addons?: string[]; delivered?: number; note?: string };

const SPECS: Spec[] = [
  { c: 0, pkg: "music-creative", status: "confirmed", shoot: 5, hour: "15:00", created: -20, lead: "instagram", loc: "Boston, MA", pays: [["deposit", "stripe", "deposit", -20]], addons: ["music-concept"] },
  { c: 1, pkg: "brand-intro", status: "pre_production", shoot: 9, hour: "10:00", created: -30, lead: "referral", loc: "Cambridge, MA", pays: [["deposit", "stripe", "deposit", -29]], note: "Shot list approved. Interview with founder + product B-roll." },
  { c: 2, pkg: "content-signature", status: "editing", shoot: -6, hour: "11:00", created: -40, lead: "instagram", loc: "Dorchester, MA", pays: [["deposit", "stripe", "deposit", -39]], due: -2 },
  { c: 3, pkg: "event-highlight", status: "delivered", shoot: -25, hour: "19:00", created: -60, lead: "google", loc: "Providence, RI", pays: [["deposit", "stripe", "deposit", -59], ["final", "zelle", "balance", -10]], delivered: -8 },
  { c: 4, pkg: "estate-tour", status: "shoot_scheduled", shoot: 2, hour: "09:00", created: -12, lead: "linkedin", loc: "Quincy, MA", pays: [["deposit", "stripe", "deposit", -12]] },
  { c: 5, pkg: "music-run-and-gun", status: "new_inquiry", shoot: null, created: -2, lead: "tiktok", pays: [] },
  { c: 6, pkg: "event-afterfilm", status: "deposit_pending", shoot: 21, hour: "18:00", created: -1, lead: "website", loc: "Newport, RI", pays: [] },
  { c: 7, pkg: "content-essential", status: "paid", shoot: -35, hour: "08:00", created: -70, lead: "instagram", loc: "Somerville, MA", pays: [["deposit", "stripe", "deposit", -69], ["final", "cash", "balance", -30]] },
  { c: 0, pkg: "music-run-and-gun", status: "archived", shoot: -120, hour: "20:00", created: -150, lead: "instagram", loc: "Boston, MA", pays: [["deposit", "stripe", "deposit", -149], ["final", "cash_app", "balance", -118]], delivered: -110 },
  { c: 8, pkg: "music-full-concept", status: "client_review", shoot: -14, hour: "12:00", created: -55, lead: "referral", loc: "Lynn, MA", pays: [["deposit", "stripe", "deposit", -54], ["partial", "venmo", 30000, -14]], addons: [], note: "Rough cut sent. Waiting on notes." },
  { c: 9, pkg: "music-creative", status: "canceled", shoot: -45, hour: "16:00", created: -80, lead: "youtube", loc: "Worcester, MA", pays: [["deposit", "stripe", "deposit", -79]] },
  { c: 10, pkg: "content-campaign", status: "final_payment_due", shoot: -10, hour: "07:00", created: -45, lead: "direct_outreach", loc: "Salem, MA", pays: [["deposit", "stripe", "deposit", -44]], due: 4 },
  { c: 11, pkg: "music-creative", status: "delivered", shoot: -95, hour: "17:00", created: -130, lead: "instagram", loc: "Boston, MA", pays: [["deposit", "stripe", "deposit", -129], ["final", "stripe", "balance", -90]], delivered: -85 },
  { c: 1, pkg: "brand-story", status: "archived", shoot: -160, hour: "09:00", created: -200, lead: "referral", loc: "Cambridge, MA", pays: [["deposit", "stripe", "deposit", -199], ["final", "bank_transfer", "balance", -150]], delivered: -140 },
  { c: 3, pkg: "content-signature", status: "confirmed", shoot: 14, hour: "13:00", created: -6, lead: "repeat_client", loc: "Providence, RI", pays: [["deposit", "stripe", "deposit", -6]] },
  { c: 12, pkg: "music-full-concept", status: "delivered", shoot: -200, hour: "10:00", created: -230, lead: "referral", loc: "Boston, MA", pays: [["deposit", "stripe", "deposit", -229], ["final", "bank_transfer", "balance", -190]], adj: -10000, delivered: -180 },
  { c: 13, pkg: "content-essential", status: "canceled", shoot: -60, hour: "14:00", created: -75, lead: "instagram", loc: "Brookline, MA", pays: [["deposit", "stripe", "deposit", -74, "refunded", -1]] },
  { c: 7, pkg: "content-signature", status: "revision", shoot: -18, hour: "08:00", created: -40, lead: "repeat_client", loc: "Somerville, MA", pays: [["deposit", "stripe", "deposit", -39]], due: 3, addons: ["extra-revision"] },
  { c: 2, pkg: "content-essential", status: "archived", shoot: -150, hour: "11:00", created: -170, lead: "instagram", loc: "Dorchester, MA", pays: [["deposit", "stripe", "deposit", -169], ["final", "zelle", "balance", -148]], delivered: -140 },
  { c: 4, pkg: "estate-tour", status: "archived", shoot: -100, hour: "09:00", created: -110, lead: "linkedin", loc: "Quincy, MA", pays: [["deposit", "stripe", "deposit", -109], ["final", "stripe", "balance", -95]], delivered: -93 },
  { c: 14, pkg: "music-creative", status: "confirmed", shoot: 30, hour: "18:00", created: -3, lead: "google", loc: "Boston, MA", pays: [["deposit", "stripe", "deposit", -3]] },
  { c: 10, pkg: "content-essential", status: "delivered", shoot: -220, hour: "07:00", created: -240, lead: "direct_outreach", loc: "Salem, MA", pays: [["deposit", "stripe", "deposit", -239], ["final", "check", "balance", -215]], delivered: -210 },
];

// Recurring overhead plus one-off production costs (cents).
const MONTHLY: [string, number, string, string][] = [["Adobe Creative Cloud", 5999, "editing_software", "Adobe"], ["Epidemic Sound", 1699, "music_licensing", "Epidemic Sound"], ["Frame.io", 1500, "subscriptions", "Frame.io"]];
const ONE_OFF: [string, number, string, number, string | null, number | null][] = [
  ["Sigma 24-70 f/2.8 lens", 189900, "gear", -130, "B&H Photo", null], ["Aputure 600d rental", 12500, "gear_rental", -7, "Rule Boston Camera", 2],
  ["Gas — Providence shoot", 4800, "gas", -25, "Shell", 3], ["Parking — Cambridge", 3200, "parking", -29, "LAZ Parking", null],
  ["Second shooter", 30000, "crew", -14, "Contractor", 9], ["Crew lunch", 8600, "food", -14, "Tatte", 9], ["Instagram ads", 15000, "advertising", -40, "Meta", null],
  ["Instagram ads", 15000, "advertising", -70, "Meta", null], ["Business insurance (quarter)", 12000, "insurance", -85, "Hiscox", null],
  ["Props — bakery set", 5400, "props", -36, "Target", 7], ["Studio rental", 25000, "location", -18, "Cove Studios", 17], ["Website hosting", 2000, "website", -50, "Vercel", null],
];

const id = (kind: "c" | "b" | "p" | "e", n: number) => `${{ c: "0000c", b: "0000b", p: "0000a", e: "0000e" }[kind]}${String(n).padStart(3, "0")}-0000-4000-8000-000000000000`;

export function buildDemoData(): DemoTables {
  const today = nyDay(new Date());
  const at = (offset: number, time = "15:00") => nyInstant(addDays(today, offset), time).toISOString();
  let eventId = 1;
  const t: DemoTables = { clients: [], bookings: [], booking_addons: [], payments: [], expenses: [], booking_events: [], business_settings: [], audit_logs: [], notifications: [], admins: [], projects: [], project_stages: [], project_tasks: [], project_time_sessions: [] };

  CLIENTS.forEach(([name, company, type, social], i) => t.clients.push({
    id: id("c", i), name, email: `${name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "")}@example.com`,
    phone: `(617) 555-01${String(i).padStart(2, "0")}`, company, social: social || null, client_type: type, notes: null,
    created_at: at(-240, "09:00"), updated_at: at(-240, "09:00"),
  }));

  SPECS.forEach((s, i) => {
    const pkg = bookingPackages.find((p) => p.id === s.pkg)!;
    const addons = bookingAddons.filter((a) => s.addons?.includes(a.id));
    const addonsCents = addons.reduce((sum, a) => sum + a.price, 0);
    const total = pkg.price + addonsCents + (s.adj ?? 0);
    const start = s.shoot === null ? null : at(s.shoot, s.hour);
    const bookingId = id("b", i);
    t.bookings.push({
      id: bookingId, reference: null, cal_uid: null, client_id: id("c", s.c), source: s.pays.length && s.pays[0][1] === "stripe" ? "website" : "manual",
      status: s.status, package_id: pkg.id, package_name: pkg.name, service_category: pkg.category, project_title: { music: "Music Video", content: "Social Content", brand: "Brand Film", events: "Event Film", estate: "Property Film", custom: "Custom project" }[pkg.category],
      project_description: "Demo booking. Fictional client used to preview the dashboard.", client_message: null, location: s.loc ?? null,
      shoot_start: start, shoot_end: start ? new Date(Date.parse(start) + pkg.minutes * 60000).toISOString() : null,
      package_price_cents: pkg.price, addons_cents: addonsCents, adjustment_cents: s.adj ?? 0, deposit_required_cents: pkg.deposit,
      balance_due_date: s.due === undefined ? null : addDays(today, s.due), lead_source: s.lead, lead_source_detail: null, notes: null, policy_version: null,
      delivered_at: s.delivered === undefined ? null : at(s.delivered), canceled_at: s.status === "canceled" ? at(s.created + 10) : null,
      payment_link_id: null, payment_link_url: null, payment_link_cents: null, created_at: at(s.created, "11:00"), updated_at: at(Math.max(s.created, -1), "11:00"),
    });
    addons.forEach((a) => t.booking_addons.push({ booking_id: bookingId, addon_id: a.id, name: a.name, price_cents: a.price }));
    t.booking_events.push({ id: eventId++, booking_id: bookingId, kind: "created", from_status: null, to_status: "new_inquiry", detail: "Demo booking", actor: "system", occurred_at: at(s.created, "11:00") });
    let paid = 0;
    s.pays.forEach(([type, method, amount, day, status = "succeeded", refundedDay], j) => {
      const cents = amount === "deposit" ? pkg.deposit : amount === "balance" ? total - paid : amount;
      paid += cents;
      const refunded = refundedDay !== undefined ? cents : 0;
      t.payments.push({
        id: id("p", i * 10 + j), booking_id: bookingId, type, method, status, amount_cents: cents, refunded_cents: refunded, currency: "usd",
        paid_at: at(day), stripe_payment_intent_id: method === "stripe" ? `pi_demo_${i}_${j}` : null, cal_payment_id: null, notes: null, created_at: at(day), updated_at: at(day),
      });
      t.booking_events.push({ id: eventId++, booking_id: bookingId, kind: "payment_received", from_status: null, to_status: null, detail: `${type[0].toUpperCase()}${type.slice(1)} payment of $${(cents / 100).toFixed(2)}`, actor: method === "stripe" ? "stripe" : "admin", occurred_at: at(day) });
      if (refunded) t.booking_events.push({ id: eventId++, booking_id: bookingId, kind: "payment_refunded", from_status: null, to_status: null, detail: `Refunded $${(refunded / 100).toFixed(2)}`, actor: "stripe", occurred_at: at(s.created + 12) });
    });
    if (s.status !== "new_inquiry") t.booking_events.push({ id: eventId++, booking_id: bookingId, kind: "status_changed", from_status: "new_inquiry", to_status: s.status, detail: null, actor: "admin", occurred_at: at(Math.min(-1, (s.shoot ?? 0) + 1), "10:00") });
    if (s.note) t.booking_events.push({ id: eventId++, booking_id: bookingId, kind: "note", from_status: null, to_status: null, detail: s.note, actor: "admin", occurred_at: at(-1, "09:30") });
  });

  let e = 0;
  for (let m = 0; m < 8; m++) for (const [name, cents, category, vendor] of MONTHLY) {
    t.expenses.push({ id: id("e", e++), name, amount_cents: cents, spent_on: addDays(today, -m * 30 - 3), category, vendor, booking_id: null, payment_method: "other", receipt_path: null, notes: null });
  }
  for (const [name, cents, category, day, vendor, booking] of ONE_OFF) {
    t.expenses.push({ id: id("e", e++), name, amount_cents: cents, spent_on: addDays(today, day), category, vendor, booking_id: booking === null ? null : id("b", booking), payment_method: "other", receipt_path: null, notes: null });
  }

  t.business_settings.push({
    id: true, business_name: "Vizuals by MB", email: "hello@vizualbymb.com", phone: null, address: null, currency: "usd", default_deposit_percent: 50, tax_percent: 0,
    invoice_terms: null, cancellation_terms: null, payment_terms: null, client_emails_enabled: false, admin_emails_enabled: true, auto_status_enabled: true,
    reminder_days_before_due: 3, archive_after_days: 30, updated_at: at(-1),
  });
  t.notifications.push(
    { id: 2, booking_id: id("b", 6), kind: "admin_new_booking", channel: "email", recipient: "hello@vizualbymb.com", dedupe_key: "demo-2", status: "sent", error: null, created_at: at(-1, "18:05") },
    { id: 1, booking_id: id("b", 20), kind: "admin_payment", channel: "email", recipient: "hello@vizualbymb.com", dedupe_key: "demo-1", status: "sent", error: null, created_at: at(-3, "12:10") },
  );
  return t;
}
