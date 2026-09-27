import { NextResponse } from "next/server";
import { withAssistantAuth } from "@/lib/assistant/handler";
import { bookingAddons, eligibleAddonsFor } from "@/data/booking";
import { serializeAddon } from "@/lib/assistant/serialize";
import { catalogPackages } from "@/lib/booking/catalog.server";

export async function GET(request: Request) {
  return withAssistantAuth(request, "addons.list", 60, 60, async () => {
    const packages = await catalogPackages();
    return NextResponse.json({ success: true, code: "ADDONS_READY", addons: bookingAddons.map((addon) => ({ ...serializeAddon(addon), eligiblePackageIds: packages.filter((pkg) => eligibleAddonsFor(pkg).some((item) => item.id === addon.id)).map((pkg) => pkg.id) })), next_action: "quote_package" });
  });
}
