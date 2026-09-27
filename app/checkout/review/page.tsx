import Link from "next/link";
import { cookies } from "next/headers";
import { CalendarDays, ArrowUpRight } from "lucide-react";
import { AssistantCheckout } from "@/components/booking/AssistantCheckout";
import { bookingEnabled, bookingPolicies, calEvents } from "@/lib/booking/config";
import { activePromotions } from "@/lib/booking/promotions.server";
import { resolvePromotion } from "@/lib/booking/promotions.server";
import { checkoutCatalogPackages } from "@/lib/booking/catalog.server";
import { quoteFor } from "@/data/booking";
import { bookingStore } from "@/lib/booking/store";
import { ASSISTANT_DRAFT_COOKIE, draftKey, type AssistantDraft } from "@/lib/assistant/draft";
import styles from "@/app/booking/portal.module.css";

export const dynamic = "force-dynamic";

export default async function CheckoutReviewPage() {
  const token = (await cookies()).get(ASSISTANT_DRAFT_COOKIE)?.value || "";
  const draft = /^[a-f0-9]{64}$/.test(token) ? await bookingStore().get<AssistantDraft>(draftKey(token)) : null;
  if (!draft) {
    return <main id="main-content"><div className={styles.emptyState}><CalendarDays size={36} /><h3>This booking link has expired.</h3><p>Please request a fresh link from the assistant. No booking or charge was created.</p><Link href="/booking" className={styles.primaryButton}>Choose a package <ArrowUpRight size={17} /></Link></div></main>;
  }
  const [promotions, packages, promotion] = await Promise.all([activePromotions(), checkoutCatalogPackages(), resolvePromotion(draft.packageId, draft.promoCode).catch(() => null)]);
  const selected = packages.find((pkg) => pkg.id === draft.packageId);
  let current = Boolean(selected && !selected.inquiryOnly && calEvents()[draft.packageId]);
  try {
    if (!selected || (draft.promotionId && promotion?.id !== draft.promotionId)) current = false;
    else quoteFor(draft.packageId, draft.addonIds, draft.paymentOption, promotion, packages);
  } catch { current = false; }
  if (!current) {
    return <main id="main-content"><div className={styles.emptyState}><CalendarDays size={36} /><h3>This booking needs a fresh review.</h3><p>The package, offer, or add-ons changed after this link was created. Nothing was charged or reserved.</p><Link href="/booking" className={styles.primaryButton}>Review current packages <ArrowUpRight size={17} /></Link></div></main>;
  }
  return <AssistantCheckout
    live={bookingEnabled()}
    policies={bookingPolicies()}
    enabledPackages={Object.keys(calEvents())}
    fullPaymentPackages={Object.entries(calEvents()).filter(([, event]) => event.full).map(([id]) => id)}
    promotions={promotions}
    packages={packages}
    initialPackageId={draft.packageId}
    initialAddonIds={draft.addonIds}
    initialSlot={draft.selectedSlot}
    initialPaymentOption={draft.paymentOption}
    initialPromoCode={draft.promoCode}
    initialIntake={{ name: draft.name, email: draft.email, phone: draft.phone, company: draft.company, location: draft.location, project: draft.project, referral: draft.referral || undefined }}
  />;
}
