import { NextResponse } from "next/server";
import { z } from "zod";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { checkoutCatalogPackages } from "@/lib/booking/catalog.server";
import { resolvePromotion } from "@/lib/booking/promotions.server";
import { quoteFor, money } from "@/data/booking";
import { serializePackage } from "@/lib/assistant/serialize";

const bodySchema = z.object({
  packageId: z.string().max(60),
  addonIds: z.array(z.string().max(60)).max(3).default([]),
  paymentOption: z.enum(["deposit", "full"]).default("deposit"),
  promoCode: z.string().trim().max(40).default(""),
});

// Pricing is never computed by the assistant. This wraps the same server-side
// quoteFor()/resolvePromotion() the booking widget re-validates against right
// before payment (data/booking.ts, lib/booking/promotions.server.ts).
export async function POST(request: Request) {
  return withAssistantAuth(request, "quote.create", 30, 60, async (_clientId, rawBody) => {
    const parsed = bodySchema.safeParse(JSON.parse(rawBody || "{}"));
    if (!parsed.success) return NextResponse.json({ success: false, code: "INVALID_REQUEST", error: "packageId is required." }, { status: 400 });
    const { packageId, addonIds, paymentOption, promoCode } = parsed.data;
    const packages = await checkoutCatalogPackages();
    const pkg = packages.find((item) => item.id === packageId);
    if (!pkg) return NextResponse.json({ success: false, code: "PACKAGE_NOT_FOUND", error: "No package matches that id.", next_action: "choose_package" }, { status: 404 });
    if (pkg.inquiryOnly) {
      return NextResponse.json({ success: false, code: "CUSTOM_REQUEST_REQUIRED", error: "This is a custom production without a fixed price.", package: serializePackage(pkg), next_action: "collect_custom_request" });
    }
    try {
      const promotion = await resolvePromotion(packageId, promoCode);
      const quote = quoteFor(packageId, addonIds, paymentOption, promotion, packages);
      return NextResponse.json({
        success: true,
        code: "QUOTE_READY",
        quote: {
          packageId: quote.pkg.id,
          addons: quote.addons.map((addon) => ({ id: addon.id, name: addon.name, priceCents: addon.price })),
          totalCents: quote.total, totalFormatted: money(quote.total),
          packagePriceCents: quote.packagePrice, originalPriceCents: quote.originalPrice,
          savingsCents: quote.savings, promotionId: quote.promotion?.id ?? null,
          depositCents: quote.deposit, dueNowCents: quote.dueNow, dueNowFormatted: money(quote.dueNow),
          balanceCents: quote.balance, paymentOption: quote.paymentOption,
        },
        next_action: "select_time",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message === "PROMO_CODE_REQUIRED") return NextResponse.json({ success: false, code: "PROMO_CODE_REQUIRED", error: "A promo code is required for this package's current offer.", next_action: "collect_promo_code" }, { status: 409 });
      return NextResponse.json({ success: false, code: "INVALID_QUOTE_REQUEST", error: "Choose a valid package and add-on combination.", next_action: "choose_package" }, { status: 400 });
    }
  });
}
