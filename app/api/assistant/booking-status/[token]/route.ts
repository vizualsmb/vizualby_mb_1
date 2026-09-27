import { NextResponse } from "next/server";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { bookingStore } from "@/lib/booking/store";
import { draftKey, draftReferenceKey, type AssistantDraft, type AssistantDraftLink } from "@/lib/assistant/draft";
import { reconcileBooking } from "@/lib/booking/reconcile";
import { money } from "@/data/booking";

// Keyed by the draftToken returned from checkout-session, not by any Cal.com
// or Stripe identifier — Base44 never needs to know those. Status is always
// re-derived live via reconcileBooking(), the same server-authoritative state
// machine the confirmation page polls (lib/booking/reconcile.ts).
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withAssistantAuth(request, "booking.status", 60, 60, async (clientId) => {
    if (!/^[a-f0-9]{64}$/.test(token)) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Invalid draft token." }, { status: 400 });
    const store = bookingStore();
    const link = await store.get<AssistantDraftLink>(draftReferenceKey(token));
    if (!link) {
      const draft = await store.get<AssistantDraft>(draftKey(token));
      return draft
        ? draft.clientId === clientId
          ? NextResponse.json({ success: true, code: "AWAITING_CHECKOUT", message: "The customer has not completed checkout yet." })
          : NextResponse.json({ success: false, code: "BOOKING_NOT_FOUND", error: "No booking matches that token." }, { status: 404 })
        : NextResponse.json({ success: false, code: "BOOKING_NOT_FOUND", error: "No booking matches that token." }, { status: 404 });
    }
    if (link.clientId !== clientId) return NextResponse.json({ success: false, code: "BOOKING_NOT_FOUND", error: "No booking matches that token." }, { status: 404 });
    const uid = await store.get<string>(`booking:reference:${link.reference}`);
    if (!uid) return NextResponse.json({ success: true, code: "AWAITING_CONFIRMATION", message: "Checkout was started but payment has not been confirmed yet." });
    const record = await reconcileBooking(uid);
    if (!record) return NextResponse.json({ success: true, code: "AWAITING_CONFIRMATION", message: "Checkout was started but payment has not been confirmed yet." });
    const codeByState: Record<string, string> = {
      confirmed: "CONFIRMED", paid_deposit: "DEPOSIT_PAID", awaiting_payment: "AWAITING_CONFIRMATION",
      cancelled: "CANCELLED", refunded: "REFUNDED", rescheduled: "RESCHEDULED", needs_review: "NEEDS_REVIEW",
    };
    return NextResponse.json({
      success: true,
      code: codeByState[record.state] ?? "NEEDS_REVIEW",
      booking: {
        packageName: record.packageName, totalCents: record.total, totalFormatted: money(record.total),
        dueNowCents: record.dueNow ?? record.deposit, balanceCents: record.balance,
        paymentOption: record.paymentOption ?? "deposit", start: record.start, end: record.end,
      },
    });
  });
}
