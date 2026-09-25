import { bookingEnabled, bookingPolicies } from "@/lib/booking/config";
import styles from "../portal.module.css";
import { musicBookingTerms } from "@/data/music-booking";
export const dynamic = "force-dynamic";
export default function BookingTerms() {
  const policy = bookingPolicies();
  policy.balance = `${musicBookingTerms.deposit} ${musicBookingTerms.balance} For music-video packages. ${policy.balance}`;
  return <main id="main-content" className={styles.legal}><p className={styles.eyebrow}>{bookingEnabled() ? `BOOKING TERMS / ${policy.version}` : "DRAFT / NOT OPEN FOR BOOKINGS"}</p><h1>A clear start.<br /><em>A better production.</em></h1><h2>Your production</h2><p>The selected package describes the shoot duration, locations, deliverables, revisions, and estimated turnaround. Additional scope requires a separate written agreement. All listed amounts are in USD.</p><h2>Deposit & balance</h2><p>The required deposit is applied to the total package price. A date is confirmed only after successful payment and calendar confirmation.</p><p>{policy.balance}</p><h2>Cancellation</h2><p>{policy.cancellation}</p><h2>Rescheduling</h2><p>{policy.rescheduling}</p><h2>Questions before booking?</h2><p>Contact <a href="mailto:hello@vizualbymb.com">hello@vizualbymb.com</a> before paying if your scope, travel requirements, or policies need clarification.</p><a href="/booking">Back to the booking room →</a></main>;
}
