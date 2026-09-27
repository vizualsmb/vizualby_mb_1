export type DiscountType = "flat" | "percentage";

export type PublicPromotion = {
  id: string;
  packageId: string;
  originalPrice: number;
  discountedPrice: number;
  discountType: DiscountType;
  label: string | null;
  startsOn: string;
  endsOn: string;
  bookingDeadline: string | null;
  limitedQuantity: number | null;
  remainingQuantity: number | null;
  requiresCode: boolean;
  valueNote: string | null;
};

export const savingsFor = (promotion: Pick<PublicPromotion, "originalPrice" | "discountedPrice">) =>
  Math.max(0, promotion.originalPrice - promotion.discountedPrice);

export const savingsPercentFor = (promotion: Pick<PublicPromotion, "originalPrice" | "discountedPrice">) =>
  promotion.originalPrice > 0 ? Math.round((savingsFor(promotion) / promotion.originalPrice) * 100) : 0;

export function promotionDateLabel(date: string) {
  return new Intl.DateTimeFormat("en-US", { month: "long", day: "numeric", timeZone: "America/New_York" }).format(new Date(`${date}T12:00:00-04:00`));
}
