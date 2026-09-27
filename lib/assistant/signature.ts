import { createHash, createHmac } from "node:crypto";

export const ASSISTANT_SIGNATURE_VERSION = "v1";

export function assistantSignaturePayload(request: Request, rawBody: string) {
  const url = new URL(request.url);
  const timestamp = request.headers.get("x-timestamp") || "";
  const nonce = request.headers.get("x-nonce") || "";
  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  return [ASSISTANT_SIGNATURE_VERSION, request.method.toUpperCase(), `${url.pathname}${url.search}`, timestamp, nonce, bodyHash].join("\n");
}

export function createAssistantSignature(secret: string, request: Request, rawBody: string) {
  return createHmac("sha256", secret).update(assistantSignaturePayload(request, rawBody)).digest("hex");
}

export function assistantIdempotencyHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
