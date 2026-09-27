import type { SchedulingEvent } from "./scheduler";
import { depositFor, type BookingPackage } from "@/data/booking";
import { calEvents } from "./config";

const CAL_API_VERSION = "2026-06-12";

type JsonObject = Record<string, unknown>;

type CalEventState = {
  event: SchedulingEvent;
  title: string;
  length: number;
  metadata: JsonObject;
};

export type CalPackageSync = {
  deposit: { event: SchedulingEvent; price: number; title: string };
  full?: { event: SchedulingEvent; price: number; title: string };
  minutes: number;
};

export type CatalogSyncPackage = Pick<BookingPackage, "id" | "name" | "minutes" | "depositPercent">;

function headers() {
  const key = process.env.CAL_API_KEY;
  if (!key) throw new Error("CAL_API_KEY is not configured");
  return { Authorization: `Bearer ${key}`, "cal-api-version": CAL_API_VERSION, "Content-Type": "application/json" };
}

async function readEvent(event: SchedulingEvent): Promise<CalEventState> {
  const response = await fetch(`https://api.cal.com/v2/event-types/${event.eventTypeId}`, {
    headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`Cal.com could not read event ${event.eventTypeId}`);
  const body = await response.json() as { data?: JsonObject };
  const data = body.data;
  const title = data?.title;
  const length = data?.lengthInMinutes;
  const metadata = data?.metadata;
  if (typeof title !== "string" || typeof length !== "number" || !metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    throw new Error(`Cal.com returned an invalid event ${event.eventTypeId}`);
  }
  if (data?.bookingUrl !== `https://cal.com/${event.calLink}`) throw new Error(`Cal.com link mismatch for event ${event.eventTypeId}`);
  return { event, title, length, metadata: metadata as JsonObject };
}

function metadataWithPrice(metadata: JsonObject, price: number) {
  const apps = metadata.apps;
  if (!apps || typeof apps !== "object" || Array.isArray(apps)) throw new Error("Cal.com Stripe payments are not configured");
  const stripe = (apps as JsonObject).stripe;
  if (!stripe || typeof stripe !== "object" || Array.isArray(stripe)) throw new Error("Cal.com Stripe payments are not configured");
  const stripeData = stripe as JsonObject;
  if (stripeData.enabled !== true || stripeData.paymentOption !== "ON_BOOKING") {
    throw new Error("Cal.com must collect payment when the booking is made");
  }
  return {
    ...metadata,
    apps: { ...(apps as JsonObject), stripe: { ...stripeData, enabled: true, paymentOption: "ON_BOOKING", price, currency: "usd" } },
  };
}

async function patchEvent(state: CalEventState, title: string, length: number, metadata: JsonObject) {
  // Cal's event editor uses this authenticated endpoint for app metadata such as
  // Stripe pricing. Only the fields managed by this catalog are sent.
  const response = await fetch(`https://api.cal.com/v2/atoms/event-types/${state.event.eventTypeId}`, {
    method: "PATCH", headers: headers(), cache: "no-store", signal: AbortSignal.timeout(10000),
    body: JSON.stringify({ id: state.event.eventTypeId, title, length, metadata }),
  });
  if (!response.ok) throw new Error(`Cal.com could not update event ${state.event.eventTypeId}`);
}

async function restoreEvent(state: CalEventState) {
  await patchEvent(state, state.title, state.length, state.metadata);
}

async function syncEvent(event: SchedulingEvent, title: string, price: number, minutes: number) {
  const before = await readEvent(event);
  const metadata = metadataWithPrice(before.metadata, price);
  await patchEvent(before, title, minutes, metadata);
  const after = await readEvent(event);
  const stripe = ((after.metadata.apps as JsonObject | undefined)?.stripe as JsonObject | undefined);
  if (after.title !== title || after.length !== minutes || stripe?.enabled !== true || stripe?.paymentOption !== "ON_BOOKING" || stripe?.price !== price || String(stripe?.currency).toLowerCase() !== "usd") {
    await restoreEvent(before).catch(() => undefined);
    throw new Error(`Cal.com did not confirm event ${event.eventTypeId}`);
  }
  return before;
}

export async function syncCalPackage(input: CalPackageSync) {
  const changed: CalEventState[] = [];
  try {
    changed.push(await syncEvent(input.deposit.event, input.deposit.title, input.deposit.price, input.minutes));
    if (input.full) changed.push(await syncEvent(input.full.event, input.full.title, input.full.price, input.minutes));
    return changed;
  } catch (error) {
    await Promise.allSettled(changed.reverse().map(restoreEvent));
    throw error;
  }
}

export async function rollbackCalPackage(states: CalEventState[]) {
  const results = await Promise.allSettled([...states].reverse().map(restoreEvent));
  if (results.some((result) => result.status === "rejected")) throw new Error("Cal.com rollback failed");
}

export async function syncCatalogPackage(pkg: CatalogSyncPackage, effectivePrice: number) {
  const mapping = calEvents()[pkg.id];
  if (!mapping) return null;
  const deposit = depositFor(effectivePrice, pkg.depositPercent);
  if (deposit < 50) throw new Error("Online packages need a deposit of at least $0.50 for Cal.com payment.");
  return syncCalPackage({
    deposit: { event: mapping, price: deposit, title: `${pkg.name} — Deposit` },
    full: mapping.full ? { event: mapping.full, price: effectivePrice, title: `${pkg.name} — Pay in full` } : undefined,
    minutes: pkg.minutes,
  });
}
