import "server-only";
import { depositFor, money, type BookingPackage } from "@/data/booking";
import { savingsFor, savingsPercentFor, type PublicPromotion } from "@/lib/booking/promotions";

export function serializePackage(pkg: BookingPackage, promotion?: PublicPromotion | null) {
  return {
    id: pkg.id,
    category: pkg.category,
    name: pkg.name,
    tagline: pkg.tagline,
    priceCents: pkg.price,
    priceFormatted: money(pkg.price),
    depositCents: pkg.deposit,
    depositFormatted: money(pkg.deposit),
    durationMinutes: pkg.minutes,
    locations: pkg.locations,
    locationLabel: pkg.locationLabel ?? null,
    revisions: pkg.revisions,
    delivery: pkg.delivery,
    includes: pkg.includes,
    featured: Boolean(pkg.featured),
    inquiryOnly: Boolean(pkg.inquiryOnly),
    startingPrice: Boolean(pkg.startingPrice),
    currency: "usd",
    promotion: promotion ? {
      id: promotion.id,
      label: promotion.label,
      discountedPriceCents: promotion.discountedPrice,
      discountedPriceFormatted: money(promotion.discountedPrice),
      depositCents: depositFor(promotion.discountedPrice, pkg.depositPercent),
      depositFormatted: money(depositFor(promotion.discountedPrice, pkg.depositPercent)),
      savingsCents: savingsFor(promotion),
      savingsPercent: savingsPercentFor(promotion),
      requiresCode: promotion.requiresCode,
      endsOn: promotion.endsOn,
      bookingDeadline: promotion.bookingDeadline,
      remainingQuantity: promotion.remainingQuantity,
    } : null,
  };
}

export function serializeAddon(addon: { id: string; name: string; description: string; price: number }) {
  return { id: addon.id, name: addon.name, description: addon.description, priceCents: addon.price, priceFormatted: money(addon.price) };
}
