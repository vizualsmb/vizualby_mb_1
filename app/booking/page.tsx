import { BookingPortal } from "@/components/booking/BookingPortal";
import { bookingEnabled, bookingPolicies, calEvents } from "@/lib/booking/config";
import { activePromotions } from "@/lib/booking/promotions.server";
import { catalogPackages } from "@/lib/booking/catalog.server";

export const dynamic = "force-dynamic";
export default async function BookingPage() {
  const promotions = await activePromotions();
  const packages = await catalogPackages();
  return <BookingPortal live={bookingEnabled()} policies={bookingPolicies()} enabledPackages={Object.keys(calEvents())} fullPaymentPackages={Object.entries(calEvents()).filter(([, e]) => e.full).map(([id]) => id)} promotions={promotions} packages={packages} />;
}
