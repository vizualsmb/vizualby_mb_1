import { z } from "zod";
import { bookingEnabled } from "@/lib/booking/config";

// Maps client_id (e.g. "MB001") to its shared HMAC secret. client_id identifies
// the tenant only; it is never treated as a credential on its own.
const clientsSchema = z.record(z.string().min(1).max(40), z.string().min(32));

export function assistantClients(): Record<string, string> {
  try { return clientsSchema.parse(JSON.parse(process.env.ASSISTANT_API_CLIENTS || "{}")); } catch { return {}; }
}

export function assistantApiEnabled() {
  return bookingEnabled() && Object.keys(assistantClients()).length > 0;
}

export const ASSISTANT_DRAFT_TTL = 2 * 60 * 60; // seconds; a review link is meant to be used soon, not held indefinitely
