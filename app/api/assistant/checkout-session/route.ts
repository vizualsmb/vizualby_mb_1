import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { checkoutCatalogPackages } from "@/lib/booking/catalog.server";
import { resolvePromotion } from "@/lib/booking/promotions.server";
import { quoteFor } from "@/data/booking";
import { calEvents } from "@/lib/booking/config";
import { slotIsAvailable, validateSchedulingEvent } from "@/lib/booking/scheduler";
import { bookingStore } from "@/lib/booking/store";
import { draftKey, type AssistantDraft } from "@/lib/assistant/draft";
import { ASSISTANT_DRAFT_TTL } from "@/lib/assistant/config";
import { bookingSiteUrl } from "@/lib/admin/stripe";
import { serializePackage } from "@/lib/assistant/serialize";
import { assistantDraftId, logAssistantLifecycle, withAssistantIdempotency } from "@/lib/assistant/auth";

const bodySchema = z.object({
  packageId: z.string().max(60),
  addonIds: z.array(z.string().max(60)).max(3).default([]),
  paymentOption: z.enum(["deposit", "full"]).default("deposit"),
  promoCode: z.string().trim().max(40).default(""),
  selectedSlot: z.iso.datetime({ offset: true }),
  name: z.string().trim().min(2).max(100),
  email: z.email().max(160).transform((s) => s.toLowerCase()),
  phone: z.string().trim().min(7).max(30),
  company: z.string().trim().max(120).default(""),
  location: z.string().trim().max(250).default(""),
  project: z.string().trim().max(2000).default(""),
  referral: z.string().trim().max(100).default(""),
});

// Creates a review draft, not a booking. The customer still lands on the
// existing checkout UI, reviews everything, accepts terms, and pays through
// the unchanged Cal.com + Stripe flow — this endpoint never touches payment
// or availability state beyond a read-only re-check.
export async function POST(request: Request) {
  return withAssistantAuth(request, "checkout.create", 15, 600, async (clientId, rawBody) => {
    return withAssistantIdempotency(request, clientId, "checkout.create", ASSISTANT_DRAFT_TTL, async () => {
    const parsed = bodySchema.safeParse(JSON.parse(rawBody || "{}"));
    if (!parsed.success) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Missing or invalid booking details." }, { status: 400 });
    const intake = parsed.data;

    const packages = await checkoutCatalogPackages();
    const pkg = packages.find((item) => item.id === intake.packageId);
    if (!pkg) return NextResponse.json({ success: false, code: "PACKAGE_NOT_FOUND", error: "No package matches that id." }, { status: 404 });
    if (pkg.inquiryOnly) return NextResponse.json({ success: false, code: "CUSTOM_REQUEST_REQUIRED", error: "This is a custom production without a fixed price.", package: serializePackage(pkg) });
    if (intake.paymentOption === "full" && intake.addonIds.length > 0) {
      return NextResponse.json({ success: false, code: "FULL_PAYMENT_UNAVAILABLE_WITH_ADDONS", error: "Choose the deposit when add-ons are included." }, { status: 409 });
    }

    let promotion;
    let quote!: ReturnType<typeof quoteFor>;
    try {
      promotion = await resolvePromotion(intake.packageId, intake.promoCode);
      quote = quoteFor(intake.packageId, intake.addonIds, intake.paymentOption, promotion, packages);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "PROMO_CODE_REQUIRED") return NextResponse.json({ success: false, code: "PROMO_CODE_REQUIRED", error: "A promo code is required for this package's current offer." }, { status: 409 });
      return NextResponse.json({ success: false, code: "INVALID_QUOTE_REQUEST", error: "Choose a valid package and add-on combination." }, { status: 400 });
    }

    const mapping = calEvents()[intake.packageId];
    const event = intake.paymentOption === "full" ? mapping?.full : mapping;
    if (!event) return NextResponse.json({ success: false, code: "PACKAGE_NOT_BOOKABLE", error: "This package is not available for online booking yet." }, { status: 409 });
    if (!await validateSchedulingEvent(event, quote.dueNow, pkg.minutes)) {
      return NextResponse.json({ success: false, code: "CHECKOUT_CONFIGURATION_MISMATCH", error: "This package needs a scheduling update before checkout." }, { status: 503 });
    }

    const slotTime = Date.parse(intake.selectedSlot);
    if (!Number.isFinite(slotTime) || slotTime <= Date.now() || slotTime > Date.now() + 366 * 86400000) {
      return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "Choose a future available date." }, { status: 400 });
    }
    if (!await slotIsAvailable(event.eventTypeId, intake.selectedSlot, pkg.minutes)) {
      return NextResponse.json({ success: false, code: "SLOT_NO_LONGER_AVAILABLE", error: "That time is no longer available. Please choose another." }, { status: 409 });
    }

    const token = randomBytes(32).toString("hex");
    const draft: AssistantDraft = {
      clientId, packageId: intake.packageId, addonIds: intake.addonIds, paymentOption: intake.paymentOption,
      promoCode: intake.promoCode, promotionId: promotion?.id ?? null, selectedSlot: intake.selectedSlot,
      name: intake.name, email: intake.email, phone: intake.phone, company: intake.company,
      location: intake.location, project: intake.project, referral: intake.referral, createdAt: new Date().toISOString(),
    };
    const store = bookingStore();
    await store.set(draftKey(token), draft, { ex: ASSISTANT_DRAFT_TTL });
    const draftId = assistantDraftId(token);
    logAssistantLifecycle({ clientId, event: "draft.created", draftId });

    return NextResponse.json({
      success: true,
      code: "CHECKOUT_CREATED",
      checkoutUrl: `${bookingSiteUrl()}/api/assistant/redeem/${token}`,
      draftToken: token,
      draftId,
      expiresInSeconds: ASSISTANT_DRAFT_TTL,
    });
    });
  });
}
