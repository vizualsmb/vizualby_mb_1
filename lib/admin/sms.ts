import "server-only";
import { normalizePhone } from "@/lib/booking/phone";

// Keep phone handling provider-neutral so this delivery layer can be reused by
// future client sites. Twilio receives E.164 values only.
export { normalizePhone };

type SmsInput = { to: string; body: string };

export async function sendTwilioSms(input: SmsInput) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const messagingServiceSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  if (!sid || !token || (!from && !messagingServiceSid)) return { ok: false as const, reason: "unconfigured" as const };

  const form = new URLSearchParams({ To: input.to, Body: input.body });
  if (messagingServiceSid) form.set("MessagingServiceSid", messagingServiceSid);
  else form.set("From", from!);

  try {
    const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: form,
      signal: AbortSignal.timeout(10000),
    });
    if (response.ok) return { ok: true as const };
    // Do not log or return the response body: Twilio can echo recipient/message data.
    return { ok: false as const, reason: "provider" as const, status: response.status };
  } catch {
    return { ok: false as const, reason: "network" as const };
  }
}
