import assert from "node:assert/strict";
import { test } from "node:test";
import { bookingPackages, eligibleAddonsFor, quoteFor } from "../data/booking";
import { assistantIdempotencyHash, assistantSignaturePayload, createAssistantSignature } from "../lib/assistant/signature";

const secret = "test-secret-that-is-at-least-thirty-two-characters";

function signedRequest(method = "POST", body = '{"packageId":"music-creative"}') {
  return new Request("https://booking.example/api/assistant/quote?locale=en", {
    method,
    headers: {
      "x-signature-version": "v1",
      "x-client-id": "MB001",
      "x-timestamp": "1790000000000",
      "x-nonce": "0123456789abcdef0123456789abcdef",
    },
    body: method === "GET" ? undefined : body,
  });
}

test("assistant signatures bind version, method, exact path, timestamp, nonce, and body hash", () => {
  const body = '{"packageId":"music-creative"}';
  const request = signedRequest("POST", body);
  const payload = assistantSignaturePayload(request, body);
  assert.match(payload, /^v1\nPOST\n\/api\/assistant\/quote\?locale=en\n1790000000000\n0123456789abcdef0123456789abcdef\n[a-f0-9]{64}$/);
  const signature = createAssistantSignature(secret, request, body);
  assert.match(signature, /^[a-f0-9]{64}$/);
  assert.notEqual(signature, createAssistantSignature(secret, signedRequest("POST", "{}"), "{}"));
  assert.notEqual(signature, createAssistantSignature(secret, signedRequest("PUT", body), body));
});

test("idempotency keys are stored only as deterministic hashes", () => {
  const hash = assistantIdempotencyHash("base44-request-00000001");
  assert.match(hash, /^[a-f0-9]{64}$/);
  assert.equal(hash, assistantIdempotencyHash("base44-request-00000001"));
  assert.notEqual(hash, assistantIdempotencyHash("base44-request-00000002"));
});

test("package add-ons are allowlisted and full-payment totals remain server-owned", () => {
  const music = bookingPackages.find((pkg) => pkg.id === "music-creative")!;
  assert.deepEqual(eligibleAddonsFor(music).map((addon) => addon.id), ["music-concept"]);
  assert.throws(() => quoteFor(music.id, ["vertical-cut"]), /valid package and add-ons/);
  const quote = quoteFor(music.id, ["music-concept"], "full");
  assert.equal(quote.total, music.price + 7500);
  assert.equal(quote.dueNow, quote.total);
});
