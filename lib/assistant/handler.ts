import "server-only";
import { NextResponse } from "next/server";
import { boundedBody } from "@/lib/booking/security";
import { assistantApiEnabled } from "./config";
import { verifyAssistantRequest, assistantRateLimit, assistantRequestId, logAssistantRequest } from "./auth";

const NO_STORE = { "Cache-Control": "no-store" };

// Shared gate for every /api/assistant/** route: config check, signed-request
// verification, per-client rate limiting, and structured logging. Keeps each
// route handler a thin wrapper around existing booking business logic.
export async function withAssistantAuth(
  request: Request,
  action: string,
  limit: number,
  windowSeconds: number,
  handler: (clientId: string, rawBody: string) => Promise<NextResponse>,
): Promise<NextResponse> {
  const started = Date.now();
  const requestId = assistantRequestId(request);
  if (!assistantApiEnabled()) {
    return NextResponse.json({ success: false, code: "ASSISTANT_API_DISABLED", error: "The assistant API is not configured." }, { status: 503, headers: NO_STORE });
  }
  let rawBody = "";
  if (request.method !== "GET" && request.method !== "HEAD") {
    try { rawBody = await boundedBody(request, 20000); } catch {
      return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Request body too large or unreadable." }, { status: 413, headers: NO_STORE });
    }
  }
  const auth = await verifyAssistantRequest(request, rawBody);
  if (!auth.ok) {
    logAssistantRequest({ clientId: request.headers.get("x-client-id") || "unknown", action, ok: false, status: auth.status, ms: Date.now() - started, requestId });
    return NextResponse.json({ success: false, code: "UNAUTHORIZED", error: auth.error }, { status: auth.status, headers: NO_STORE });
  }
  if (rawBody) {
    try { JSON.parse(rawBody); }
    catch {
      logAssistantRequest({ clientId: auth.clientId, action, ok: false, status: 400, ms: Date.now() - started, requestId });
      return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "The request body must be valid JSON." }, { status: 400, headers: { ...NO_STORE, "X-Request-Id": requestId } });
    }
  }
  const withinLimit = await assistantRateLimit(auth.clientId, action, limit, windowSeconds);
  if (!withinLimit) {
    logAssistantRequest({ clientId: auth.clientId, action, ok: false, status: 429, ms: Date.now() - started, requestId });
    return NextResponse.json({ success: false, code: "RATE_LIMITED", error: "Too many requests. Please slow down." }, { status: 429, headers: NO_STORE });
  }
  try {
    const response = await handler(auth.clientId, rawBody);
    logAssistantRequest({ clientId: auth.clientId, action, ok: response.status < 400, status: response.status, ms: Date.now() - started, requestId });
    response.headers.set("Cache-Control", "no-store");
    response.headers.set("X-Request-Id", requestId);
    return response;
  } catch {
    logAssistantRequest({ clientId: auth.clientId, action, ok: false, status: 500, ms: Date.now() - started, requestId });
    return NextResponse.json({ success: false, code: "INTERNAL_ERROR", error: "Something went wrong. Please try again." }, { status: 500, headers: NO_STORE });
  }
}
