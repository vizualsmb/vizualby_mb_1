import { NextResponse } from "next/server";
import { z } from "zod";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { createSupabaseService } from "@/lib/supabase/service";
import { deliverOnce, adminInbox, studioSettings } from "@/lib/admin/notify";
import { withAssistantIdempotency } from "@/lib/assistant/auth";

const bodySchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.email().max(160).transform((s) => s.toLowerCase()),
  phone: z.string().trim().max(30).optional(),
  requestedService: z.string().trim().min(2).max(200),
  preferredDate: z.string().trim().max(40).optional(),
  budget: z.string().trim().max(80).optional(),
  description: z.string().trim().min(1).max(2000),
});

// The catch-all for anything the assistant can't price from the existing
// catalog. No price is ever invented here — this only files the request for
// manual review, the same way an inquiry-only package works today.
export async function POST(request: Request) {
  return withAssistantAuth(request, "custom-request.create", 10, 600, async (clientId, rawBody) => {
    return withAssistantIdempotency(request, clientId, "custom-request.create", 24 * 60 * 60, async (idempotencyHash) => {
    const parsed = bodySchema.safeParse(JSON.parse(rawBody || "{}"));
    if (!parsed.success) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Missing or invalid custom request details." }, { status: 400 });
    const db = createSupabaseService();
    if (!db) return NextResponse.json({ success: false, code: "ASSISTANT_API_DISABLED", error: "Custom requests are not configured." }, { status: 503 });
    const { data, error } = await db.from("assistant_requests").insert({
      client_id: clientId, name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone ?? null,
      requested_service: parsed.data.requestedService, preferred_date: parsed.data.preferredDate ?? null,
      budget: parsed.data.budget ?? null, description: parsed.data.description,
      idempotency_key_hash: idempotencyHash,
    }).select("id").single();
    if (error?.code === "23505") {
      const existing = await db.from("assistant_requests").select("id").eq("client_id", clientId).eq("idempotency_key_hash", idempotencyHash).maybeSingle();
      if (existing.data) return NextResponse.json({ success: true, code: "CUSTOM_REQUEST_RECEIVED", requestId: existing.data.id });
    }
    if (error || !data) return NextResponse.json({ success: false, code: "INTERNAL_ERROR", error: "Could not save this request. Please try again." }, { status: 500 });

    try {
      const settings = await studioSettings(db);
      const inbox = adminInbox();
      if (settings.adminEmails && inbox) {
        await deliverOnce(db, {
          bookingId: null, kind: "assistant_custom_request", dedupeKey: `assistant-custom-request:${data.id}`, to: inbox,
          subject: `New custom request: ${parsed.data.requestedService}`,
          text: [`Name: ${parsed.data.name}`, `Email: ${parsed.data.email}`, parsed.data.phone ? `Phone: ${parsed.data.phone}` : null,
            `Requested: ${parsed.data.requestedService}`, parsed.data.preferredDate ? `Preferred date: ${parsed.data.preferredDate}` : null,
            parsed.data.budget ? `Budget: ${parsed.data.budget}` : null, "", parsed.data.description].filter(Boolean).join("\n"),
          replyTo: parsed.data.email,
        });
      }
    } catch (error) {
      console.error("assistant custom-request notification failed", { requestId: data.id, error: error instanceof Error ? error.message : String(error) });
    }
    return NextResponse.json({ success: true, code: "CUSTOM_REQUEST_RECEIVED", requestId: data.id });
    });
  });
}
