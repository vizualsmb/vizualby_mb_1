import "server-only";
import { Resend } from "resend";
import type { SupabaseClient } from "@supabase/supabase-js";

// Delivery layer for every automated message. Each message carries a dedupe key and
// is logged in public.notifications before sending, so cron reruns and webhook
// retries never send twice. A failed send is retried on the next attempt. This
// never throws: a mail outage must not fail a payment webhook. To add SMS, add a
// branch on `channel` here; callers stay the same.

export type Outgoing = {
  bookingId: string | null; kind: string; dedupeKey: string; channel?: "email";
  to: string; subject: string; text: string; replyTo?: string | null;
};
export type DeliveryResult = "sent" | "duplicate" | "failed" | "unconfigured";

export const adminSiteUrl = () => (process.env.ADMIN_SITE_URL || "https://admin.vizualbymb.com").replace(/\/$/, "");
export const adminInbox = () => process.env.ADMIN_NOTIFY_EMAIL || process.env.CONTACT_TO_EMAIL || null;

export async function studioSettings(db: SupabaseClient) {
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

export async function deliverOnce(db: SupabaseClient, msg: Outgoing): Promise<DeliveryResult> {
  const { RESEND_API_KEY, CONTACT_FROM_EMAIL } = process.env;
  if (!RESEND_API_KEY || !CONTACT_FROM_EMAIL || !msg.to) return "unconfigured";
  try {
    const row = { booking_id: msg.bookingId, kind: msg.kind, channel: msg.channel ?? "email", recipient: msg.to, dedupe_key: msg.dedupeKey, status: "sending" };
    const { data: inserted, error } = await db.from("notifications").upsert(row, { onConflict: "dedupe_key", ignoreDuplicates: true }).select("id");
    if (error) return "failed";
    let id = inserted?.[0]?.id as number | undefined;
    if (!id) {
      const { data: prior } = await db.from("notifications").select("id, status").eq("dedupe_key", msg.dedupeKey).single();
      if (!prior || prior.status !== "failed") return "duplicate";
      id = prior.id;
      await db.from("notifications").update({ status: "sending", error: null }).eq("id", id);
    }
    const { error: sendError } = await new Resend(RESEND_API_KEY).emails.send({
      from: CONTACT_FROM_EMAIL, to: msg.to, subject: msg.subject, text: msg.text, ...(msg.replyTo ? { replyTo: msg.replyTo } : {}),
    });
    await db.from("notifications").update(sendError ? { status: "failed", error: String(sendError.message).slice(0, 300) } : { status: "sent" }).eq("id", id);
    return sendError ? "failed" : "sent";
  } catch {
    return "failed";
  }
}
