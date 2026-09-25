import { createHmac, timingSafeEqual } from "node:crypto";
export function validCalSignature(body: string, signature: string | null, secret: string) {
  if (!signature || !/^[a-f0-9]{64}$/i.test(signature)) return false;
  const expected = createHmac("sha256", secret).update(body).digest();
  return timingSafeEqual(expected, Buffer.from(signature, "hex"));
}
export async function boundedBody(request: Request, limit: number) {
  const reader = request.body?.getReader();
  if (!reader) throw new Error("Missing request body.");
  const chunks: Uint8Array[] = []; let size = 0;
  while (true) {
    const { done, value } = await reader.read(); if (done) break;
    size += value.byteLength;
    if (size > limit) { await reader.cancel(); throw new Error("Request too large."); }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
