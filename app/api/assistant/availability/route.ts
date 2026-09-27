import { NextResponse } from "next/server";
import { z } from "zod";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { checkoutCatalogPackages } from "@/lib/booking/catalog.server";
import { calEvents } from "@/lib/booking/config";
import { availableSlots } from "@/lib/booking/scheduler";

const bodySchema = z.object({
  packageId: z.string().max(60),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

// Availability is always re-derived from the same studio-hours-aware Cal.com
// lookup the web widget uses (lib/booking/scheduler.ts). No calendar state is
// duplicated into this API layer or into the assistant.
export async function POST(request: Request) {
  return withAssistantAuth(request, "availability.check", 30, 60, async (_clientId, rawBody) => {
    const parsed = bodySchema.safeParse(JSON.parse(rawBody || "{}"));
    if (!parsed.success) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "packageId and month (YYYY-MM) are required." }, { status: 400 });
    const { packageId, month, date } = parsed.data;
    const packages = await checkoutCatalogPackages();
    const pkg = packages.find((item) => item.id === packageId);
    const event = calEvents()[packageId];
    if (!pkg || pkg.inquiryOnly) return NextResponse.json({ success: false, code: "PACKAGE_NOT_FOUND", error: "No bookable package matches that id." }, { status: 404 });
    if (!event) return NextResponse.json({ success: false, code: "PACKAGE_NOT_BOOKABLE", error: "This package is not available for online booking yet." }, { status: 409 });
    const start = new Date(`${month}-01T00:00:00Z`);
    const now = new Date();
    const monthDifference = (start.getUTCFullYear() - now.getUTCFullYear()) * 12 + start.getUTCMonth() - now.getUTCMonth();
    if (monthDifference < 0 || monthDifference > 12) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Choose a month within the next year." }, { status: 400 });
    const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const slots = await availableSlots(event.eventTypeId, `${month}-01`, lastDay, pkg.minutes);
    if (date) {
      if (!date.startsWith(`${month}-`)) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "date must belong to month." }, { status: 400 });
      const times = (slots[date] ?? []).map((slot) => slot.start);
      return NextResponse.json({ success: true, code: times.length ? "DATE_AVAILABLE" : "DATE_UNAVAILABLE", date, times, next_action: times.length ? "select_time" : "choose_another_date" });
    }
    return NextResponse.json({ success: true, code: "AVAILABILITY_READY", slots, next_action: "select_date" });
  });
}
