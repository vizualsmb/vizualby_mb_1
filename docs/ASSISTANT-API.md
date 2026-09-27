# Vizuals Booking Assistant API

This server-to-server API lets Base44 client `MB001` read the current Vizuals catalog, request live availability, and hand a customer into the existing Cal.com and Stripe booking flow. It does not replace the booking backend and never accepts an assistant-invented price.

## Trust boundary

- Call `/api/assistant/**` only from a Base44 backend function. Never put the shared secret in the chat widget or browser.
- `MB001` is a tenant identifier, not a credential.
- Cal.com remains authoritative for availability and reservation. Stripe remains authoritative for payment.
- Checkout creation returns a short-lived review draft. It does not reserve a slot.
- Unknown or inquiry-only work must use `custom-request`.

## Authentication

Set these headers on every request:

| Header | Value |
|---|---|
| `X-Client-Id` | `MB001` |
| `X-Signature-Version` | `v1` |
| `X-Timestamp` | Current Unix time in milliseconds |
| `X-Nonce` | Random 16–64 character hexadecimal value, never reused |
| `X-Signature` | Lowercase HMAC-SHA256 hex digest |
| `X-Request-Id` | Optional 8–80 character trace id |
| `Idempotency-Key` | Required for checkout and custom-request mutations |

Build the signed text with newline separators:

```text
v1
POST
/api/assistant/quote
1790000000000
0123456789abcdef0123456789abcdef
SHA256_HEX_OF_THE_EXACT_RAW_BODY
```

The path includes the exact query string when present. The server rejects timestamps outside five minutes and stores each nonce in Redis to prevent replay.

TypeScript signing example for a Base44 server function:

```ts
import { createHash, createHmac, randomBytes, randomUUID } from "node:crypto";

export async function callVizuals(path: string, body?: unknown, idempotent = false) {
  const method = body === undefined ? "GET" : "POST";
  const rawBody = body === undefined ? "" : JSON.stringify(body);
  const timestamp = String(Date.now());
  const nonce = randomBytes(16).toString("hex");
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  const signed = ["v1", method, path, timestamp, nonce, bodyHash].join("\n");
  const signature = createHmac("sha256", process.env.VIZUALS_ASSISTANT_SECRET!).update(signed).digest("hex");
  return fetch(`${process.env.VIZUALS_BOOKING_ORIGIN}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "X-Client-Id": "MB001",
      "X-Signature-Version": "v1",
      "X-Timestamp": timestamp,
      "X-Nonce": nonce,
      "X-Signature": signature,
      "X-Request-Id": randomUUID(),
      ...(idempotent ? { "Idempotency-Key": randomUUID() } : {}),
    },
    body: body === undefined ? undefined : rawBody,
  });
}
```

## Endpoints

### `GET /api/assistant/packages`

Returns active packages, current promotion facts, and explicit `inquiryOnly` values. Next action: `choose_package`.

### `GET /api/assistant/packages/:id`

Returns one package and only the add-ons eligible for it. An inquiry-only package returns `next_action: collect_custom_request`.

### `GET /api/assistant/addons`

Returns add-ons with `eligiblePackageIds`. Package details are the preferred source.

### `POST /api/assistant/quote`

```json
{"packageId":"music-creative","addonIds":["music-concept"],"paymentOption":"deposit","promoCode":""}
```

All amounts come from server-owned catalog data and use integer USD cents. `CUSTOM_REQUEST_REQUIRED` means the assistant must not provide a price.

### `POST /api/assistant/availability`

```json
{"packageId":"music-creative","month":"2026-10","date":"2026-10-17"}
```

Omit `date` to receive the month map. Availability is fetched from Cal.com and filtered through studio day, block, buffer, and daily-duration rules.

### `POST /api/assistant/checkout-session`

Requires `Idempotency-Key`.

```json
{
  "packageId":"music-creative",
  "addonIds":["music-concept"],
  "paymentOption":"deposit",
  "promoCode":"",
  "selectedSlot":"2026-10-17T17:00:00-04:00",
  "name":"John Smith",
  "email":"john@example.com",
  "phone":"+15555550100",
  "company":"",
  "location":"",
  "project":"Performance-driven music video with a dark studio look.",
  "referral":"AI assistant"
}
```

The backend rechecks package eligibility, price, promotion, Cal payment configuration, and the exact slot. `checkoutUrl` exchanges its opaque token for an HttpOnly cookie and redirects to a tokenless review page. The customer still accepts current terms and completes the existing Cal/Stripe checkout.

Full payment with add-ons returns `FULL_PAYMENT_UNAVAILABLE_WITH_ADDONS`; use the deposit option because add-ons are collected in the later balance.

### `GET /api/assistant/booking-status/:draftToken`

Returns only the booking state and non-sensitive commercial summary. It never returns Cal or Stripe identifiers. Tenant ownership is checked before status is disclosed.

### `POST /api/assistant/custom-request`

Requires `Idempotency-Key`.

```json
{
  "name":"John Smith",
  "email":"john@example.com",
  "phone":"+15555550100",
  "requestedService":"Two-day narrative production",
  "preferredDate":"October 17",
  "budget":"$3,000–$5,000",
  "description":"A story-driven production that does not fit a listed package."
}
```

This stores a request for manual review. It never creates or returns a price.

## Operational behavior

- Responses use `Cache-Control: no-store` and include `X-Request-Id`.
- Authentication, request completion, draft creation, checkout start, and confirmed deposit produce structured logs without customer PII or payment secrets.
- Checkout drafts expire after two hours. Started booking-status links are retained with the booking lifecycle.
- Provider failures and catalog database errors fail closed.
- Do not retry a mutation with a new idempotency key after an ambiguous timeout; retry with the original key.
