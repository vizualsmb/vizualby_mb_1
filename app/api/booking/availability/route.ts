import { createHash } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { bookingPackages } from "@/data/booking";
import { bookingEnabled, calEvents } from "@/lib/booking/config";
import { availableSlots } from "@/lib/booking/scheduler";
import { bookingStore } from "@/lib/booking/store";

export async function GET(request: NextRequest) {
  const headers = { "Cache-Control": "no-store" };
  if (!bookingEnabled()) return NextResponse.json({ error: "Online scheduling is not open yet." }, { status: 503, headers });
  const month = request.nextUrl.searchParams.get("month") || "";
  const packageId = request.nextUrl.searchParams.get("packageId") || "";
  const event = calEvents()[packageId];
  const pkg = bookingPackages.find((item) => item.id === packageId);
  if (!event || !pkg || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return NextResponse.json({ error: "Invalid schedule request." }, { status: 400, headers });
  const start = new Date(`${month}-01T00:00:00Z`);
  const now = new Date();
  const monthDifference = (start.getUTCFullYear() - now.getUTCFullYear()) * 12 + start.getUTCMonth() - now.getUTCMonth();
  if (monthDifference < 0 || monthDifference > 12) return NextResponse.json({ error: "Choose a month within the next year." }, { status: 400, headers });
  const lastDay = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
  try {
    const store = bookingStore();
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0] || "unknown";
    const key = `booking:availability-rate:${createHash("sha256").update(ip).digest("hex")}:${Math.floor(Date.now() / 60000)}`;
    const count = await store.incr(key); if (count === 1) await store.expire(key, 90);
    if (count > 30) return NextResponse.json({ error: "Please wait a moment before refreshing." }, { status: 429, headers });
    return NextResponse.json({ slots: await availableSlots(event.eventTypeId, `${month}-01`, lastDay, pkg.minutes) }, { headers });
  } catch { return NextResponse.json({ error: "We couldn’t load availability. Please try again or contact the studio." }, { status: 503, headers }); }
}
