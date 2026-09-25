import { timingSafeEqual } from "node:crypto";
import { createSupabaseService } from "@/lib/supabase/service";
import { runDailyAutomation } from "@/lib/admin/automation";

// Called once a day by Vercel Cron (vercel.json). Vercel sends
// "Authorization: Bearer $CRON_SECRET"; anything else is rejected.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  if (!secret || given.length !== expected.length || !timingSafeEqual(given, expected)) return new Response("Unauthorized", { status: 401 });
  const db = createSupabaseService();
  if (!db) return Response.json({ skipped: "Admin database not configured" });
  try {
    return Response.json(await runDailyAutomation(db), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : "Automation failed" }, { status: 500 });
  }
}
