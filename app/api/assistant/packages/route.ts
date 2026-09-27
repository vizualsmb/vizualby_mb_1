import { NextResponse } from "next/server";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { checkoutCatalogPackages } from "@/lib/booking/catalog.server";
import { activePromotions } from "@/lib/booking/promotions.server";
import { serializePackage } from "@/lib/assistant/serialize";

export async function GET(request: Request) {
  return withAssistantAuth(request, "packages.list", 60, 60, async () => {
    const [packages, promotions] = await Promise.all([checkoutCatalogPackages(), activePromotions()]);
    const promoByPackage = new Map(promotions.map((promotion) => [promotion.packageId, promotion]));
    return NextResponse.json({ success: true, code: "PACKAGES_READY", packages: packages.map((pkg) => serializePackage(pkg, promoByPackage.get(pkg.id) ?? null)), next_action: "choose_package" });
  });
}
