import { timingSafeEqual } from "node:crypto";
import { createSupabaseService } from "@/lib/supabase/service";
import { sendBookingReminderSms } from "@/lib/admin/sync";

// An hourly, server-only job keeps reminders close to 24 hours before each
// shoot without rerunning the daily status, email, or Cal.com price jobs.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  const db = createSupabaseService();
  if (!db) return Response.json({ skipped: "Admin database not configured" });
  try {
    return Response.json(await sendBookingReminderSms(db), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Do not include booking or phone data in the response or logs.
    console.error("SMS reminder job failed", { error: error instanceof Error ? error.message.slice(0, 160) : "unknown" });
    return Response.json({ error: "SMS reminder job failed" }, { status: 500 });
  }
}
