import "server-only";
import { Resend } from "resend";
import type { AdminSupabaseClient } from "@/lib/supabase/service";
import { sendTwilioSms } from "./sms";

// Delivery layer for every automated message. Each message carries a dedupe key and
// is logged in studio_admin.notifications before sending, so cron reruns and webhook
// retries never send twice. A failed send is retried on the next attempt. This
// never throws: a mail outage must not fail a payment webhook. To add SMS, add a
// branch on `channel` here; callers stay the same.

export type Outgoing = {
  bookingId: string | null; kind: string; dedupeKey: string; channel?: "email" | "sms";
  to: string; subject?: string; text: string; replyTo?: string | null;
};
export type DeliveryResult = "sent" | "duplicate" | "failed" | "unconfigured";

export const adminSiteUrl = () => (process.env.ADMIN_SITE_URL || "https://admin.vizualbymb.com").replace(/\/$/, "");
export const adminInbox = () => process.env.ADMIN_NOTIFY_EMAIL || process.env.CONTACT_TO_EMAIL || null;

export async function studioSettings(db: AdminSupabaseClient) {
  const { data } = await db.from("business_settings").select("*").eq("id", true).maybeSingle();
  return {
    name: (data?.business_name as string) || "Vizuals by MB",
    email: (data?.email as string | null) ?? process.env.CONTACT_TO_EMAIL ?? null,
    clientEmails: data?.client_emails_enabled === true,
    adminEmails: data?.admin_emails_enabled !== false,
    autoStatus: data?.auto_status_enabled !== false,
    reminderDays: (data?.reminder_days_before_due as number | undefined) ?? 3,
    archiveAfterDays: (data?.archive_after_days as number | null | undefined) ?? 30,
  };
}

export async function deliverOnce(db: AdminSupabaseClient, msg: Outgoing): Promise<DeliveryResult> {
  const channel = msg.channel ?? "email";
  const emailConfigured = Boolean(process.env.RESEND_API_KEY && process.env.CONTACT_FROM_EMAIL);
  const smsConfigured = Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && (process.env.TWILIO_FROM_NUMBER || process.env.TWILIO_MESSAGING_SERVICE_SID));
  if (!msg.to || (channel === "email" ? !emailConfigured : !smsConfigured)) return "unconfigured";
  try {
    const row = { booking_id: msg.bookingId, kind: msg.kind, channel, recipient: msg.to, dedupe_key: msg.dedupeKey, status: "sending" };
    const { data: inserted, error } = await db.from("notifications").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
    if (error) return "failed";
    let id = inserted?.[0]?.id as number | undefined;
    if (!id) {
      const { data: prior } = await db.from("notifications").select("id, status").eq("dedupe_key", msg.dedupeKey).single();
      if (!prior || prior.status !== "failed") return "duplicate";
      id = prior.id;
      await db.from("notifications").update({ status: "sending", error: null }).eq("id", id);
    }
    let sendError: { message: string } | null = null;
    if (channel === "sms") {
      const result = await sendTwilioSms({ to: msg.to, body: msg.text });
      if (!result.ok) sendError = { message: `Twilio ${result.reason}${"status" in result ? ` (${result.status})` : ""}` };
    } else {
      const result = await new Resend(process.env.RESEND_API_KEY!).emails.send({
        from: process.env.CONTACT_FROM_EMAIL!, to: msg.to, subject: msg.subject || msg.kind, text: msg.text, ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
      });
      sendError = result.error ? { message: result.error.message } : null;
    }
    await db.from("notifications").update(sendError ? { status: "failed", error: String(sendError.message).slice(0, 300) } : { status: "sent" }).eq("id", id);
    return sendError ? "failed" : "sent";
  } catch {
    return "failed";
  }
}
