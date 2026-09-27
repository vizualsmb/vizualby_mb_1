import "server-only";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { bookingStore } from "@/lib/booking/store";
import { assistantClients } from "./config";
import { ASSISTANT_SIGNATURE_VERSION, assistantIdempotencyHash, createAssistantSignature } from "./signature";

const MAX_SKEW_MS = 5 * 60 * 1000;
const NONCE_TTL = 6 * 60; // seconds; slightly wider than the timestamp skew window it guards

export type AssistantAuth = { ok: true; clientId: string } | { ok: false; status: number; error: string };

// Server-to-server auth for the assistant API: HMAC-SHA256 over timestamp + nonce +
// path + body, using a per-client secret. Never trusts client_id alone (it's a
// tenant label, not a credential), and rejects a replayed nonce even within the
// timestamp window. Modeled on this repo's existing webhook signature checks
// (lib/booking/security.ts) and the cron bearer-secret check.
export async function verifyAssistantRequest(request: Request, rawBody: string): Promise<AssistantAuth> {
  const clients = assistantClients();
  const clientId = request.headers.get("x-client-id") || "";
  const secret = clients[clientId];
  if (!secret) return { ok: false, status: 401, error: "Unknown or unconfigured client." };

  if (request.headers.get("x-signature-version") !== ASSISTANT_SIGNATURE_VERSION) {
    return { ok: false, status: 401, error: "Unsupported or missing signature version." };
  }
  const timestamp = request.headers.get("x-timestamp") || "";
  if (!/^\d{10,20}$/.test(timestamp) || Math.abs(Date.now() - Number(timestamp)) > MAX_SKEW_MS) {
    return { ok: false, status: 401, error: "Request timestamp is missing or too old." };
  }
  const nonce = request.headers.get("x-nonce") || "";
  if (!/^[a-f0-9]{16,64}$/i.test(nonce)) return { ok: false, status: 401, error: "Invalid or missing nonce." };
  const signature = request.headers.get("x-signature") || "";
  if (!/^[a-f0-9]{64}$/i.test(signature)) return { ok: false, status: 401, error: "Invalid or missing signature." };

  const expected = Buffer.from(createAssistantSignature(secret, request, rawBody), "hex");
  const given = Buffer.from(signature, "hex");
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, status: 401, error: "Signature does not match." };
  }

  try {
    const store = bookingStore();
    const first = await store.set(`assistant:nonce:${clientId}:${nonce}`, "1", { nx: true, ex: NONCE_TTL });
    if (!first) return { ok: false, status: 401, error: "This request has already been used." };
  } catch {
    return { ok: false, status: 503, error: "Assistant API is temporarily unavailable." };
  }
  return { ok: true, clientId };
}

export async function assistantRateLimit(clientId: string, action: string, limit: number, windowSeconds: number) {
  const store = bookingStore();
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000));
  const key = `assistant:rate:${clientId}:${action}:${bucket}`;
  const count = await store.incr(key);
  if (count === 1) await store.expire(key, windowSeconds + 10);
  return count <= limit;
}

// Structured, PII-free request logging. Never pass payment details or full customer records here.
export function logAssistantRequest(entry: { clientId: string; action: string; ok: boolean; status: number; ms: number; requestId?: string }) {
  console.log(JSON.stringify({ scope: "assistant-api", at: new Date().toISOString(), ...entry }));
}

export function assistantRequestId(request: Request) {
  const supplied = request.headers.get("x-request-id") || "";
  return /^[a-zA-Z0-9_-]{8,80}$/.test(supplied) ? supplied : randomUUID();
}

export function assistantDraftId(token: string) {
  return createHash("sha256").update(token).digest("hex").slice(0, 24);
}

export function logAssistantLifecycle(entry: { clientId: string; event: string; draftId?: string; ok?: boolean }) {
  console.log(JSON.stringify({ scope: "assistant-lifecycle", at: new Date().toISOString(), ...entry }));
}

type CachedResponse = { status: number; body: unknown };

export async function withAssistantIdempotency(
  request: Request,
  clientId: string,
  action: string,
  ttlSeconds: number,
  handler: (idempotencyHash: string) => Promise<NextResponse>,
) {
  const supplied = request.headers.get("idempotency-key") || "";
  if (!/^[a-zA-Z0-9_.:-]{16,120}$/.test(supplied)) {
    return NextResponse.json({ success: false, code: "IDEMPOTENCY_KEY_REQUIRED", error: "Send a unique Idempotency-Key for this request." }, { status: 400 });
  }
  const digest = assistantIdempotencyHash(supplied);
  const store = bookingStore();
  const resultKey = `assistant:idempotency:${clientId}:${action}:${digest}`;
  const lockKey = `${resultKey}:lock`;
  const cached = await store.get<CachedResponse>(resultKey);
  if (cached) return NextResponse.json(cached.body, { status: cached.status, headers: { "Idempotent-Replay": "true" } });
  const locked = await store.set(lockKey, "1", { nx: true, ex: 30 });
  if (!locked) return NextResponse.json({ success: false, code: "REQUEST_IN_PROGRESS", error: "An identical request is still processing." }, { status: 409 });
  try {
    const response = await handler(digest);
    if (response.status < 500) {
      const body = await response.clone().json().catch(() => null);
      if (body !== null) await store.set(resultKey, { status: response.status, body }, { ex: ttlSeconds });
    }
    return response;
  } finally {
    await store.del(lockKey).catch(() => undefined);
  }
}
