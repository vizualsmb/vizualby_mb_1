import { NextResponse } from "next/server";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { checkoutCatalogPackages } from "@/lib/booking/catalog.server";
import { activePromotions } from "@/lib/booking/promotions.server";
import { serializePackage, serializeAddon } from "@/lib/assistant/serialize";
import { eligibleAddonsFor } from "@/data/booking";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return withAssistantAuth(request, "packages.get", 60, 60, async () => {
    const [packages, promotions] = await Promise.all([checkoutCatalogPackages(), activePromotions()]);
    const pkg = packages.find((item) => item.id === id);
    if (!pkg) return NextResponse.json({ success: false, code: "PACKAGE_NOT_FOUND", error: "No package matches that id." }, { status: 404 });
    const promotion = promotions.find((item) => item.packageId === pkg.id) ?? null;
    const addons = pkg.inquiryOnly ? [] : eligibleAddonsFor(pkg);
    return NextResponse.json({ success: true, code: "PACKAGE_READY", package: serializePackage(pkg, promotion), addons: addons.map(serializeAddon), next_action: pkg.inquiryOnly ? "collect_custom_request" : "quote_package" });
  });
}
