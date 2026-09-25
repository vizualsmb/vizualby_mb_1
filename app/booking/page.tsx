import { BookingPortal } from "@/components/booking/BookingPortal";
import { bookingEnabled, bookingPolicies, calEvents } from "@/lib/booking/config";

export const dynamic = "force-dynamic";
export default function BookingPage() {
  return <BookingPortal live={bookingEnabled()} policies={bookingPolicies()} enabledPackages={Object.keys(calEvents())} fullPaymentPackages={Object.entries(calEvents()).filter(([, e]) => e.full).map(([id]) => id)} />;
}
