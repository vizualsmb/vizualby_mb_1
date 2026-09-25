import "server-only";
import Stripe from "stripe";

// Same Stripe account the booking webhook verifies (Cal's connected account when set),
// so balance payments arrive through the existing, signature-checked webhook.
export function adminStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const account = process.env.STRIPE_CONNECTED_ACCOUNT_ID;
  return { stripe: new Stripe(key), options: account ? { stripeAccount: account } : undefined, testMode: key.startsWith("sk_test_") || key.startsWith("rk_test_") };
}

export const bookingSiteUrl = () => (process.env.BOOKING_SITE_URL || "https://booking.vizualbymb.com").replace(/\/$/, "");
