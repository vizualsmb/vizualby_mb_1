import { Check } from "lucide-react";
import styles from "../portal.module.css";

export const metadata = { title: "Payment received", robots: { index: false, follow: false } };

// Where a balance payment link sends the client after Stripe Checkout. It only says
// thank you: the payment itself is recorded from Stripe's signed webhook.
export default function BalancePaid() {
  return <main id="main-content" className={styles.success}>
    <span className={styles.successIcon}><Check size={22} /></span>
    <h1>Thank you.</h1>
    <p className={styles.successLead}>Your payment is being processed by Stripe, and a receipt is on its way to your email. There’s nothing else you need to do. If you have any questions, just reply to the studio’s last email or write to <a href="mailto:hello@vizualbymb.com">hello@vizualbymb.com</a>.</p>
  </main>;
}
