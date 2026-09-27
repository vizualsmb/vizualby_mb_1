import { musicPackages } from "./music-booking";
import type { PublicPromotion } from "@/lib/booking/promotions";
// Music pricing is owner-supplied. Other categories remain sample catalog entries.
export type BookingCategory = "content" | "music" | "brand" | "events" | "estate" | "custom";
export const bookingCategories: { id: BookingCategory; label: string; number: string; description: string }[] = [
  { id: "content", label: "Short-form content", number: "01", description: "Aftermovies, concerts, live events, workouts, and social campaigns." },
  { id: "music", label: "Music videos", number: "02", description: "A visual world for your sound." },
  { id: "brand", label: "Brand content", number: "03", description: "For businesses, clothing brands, products, and campaigns." },
  { id: "events", label: "Event coverage", number: "04", description: "Cinematic coverage for the moments people came to feel." },
  { id: "estate", label: "Real estate", number: "05", description: "Property films designed to make a listing memorable." },
  { id: "custom", label: "Custom production", number: "06", description: "Something that doesn’t fit a package." },
];
export type BookingPackage = {
  id: string; category: BookingCategory; name: string; tagline: string; price: number;
  deposit: number; minutes: number; locations: number; revisions: number;
  delivery: string; includes: string[]; featured?: boolean;
  fullDescription?: string; image?: string; inquiryOnly?: boolean;
  bestFor?: string; locationLabel?: string; startingPrice?: boolean;
  depositPercent?: number;
  addonIds?: string[]; calEventKey?: string; stripeProductId?: string;
};
export type PackageDefinition = Omit<BookingPackage, "deposit">;
// The deposit is always half the package price (rounded to the cent).
export const DEPOSIT_SHARE = 0.5;
export const depositFor = (price: number, percent = DEPOSIT_SHARE * 100) => Math.round(price * percent / 100);
// All monetary values are integer USD cents.
const packageDefinitions: PackageDefinition[] = [
  { id: "content-basic", category: "content", name: "The Basic", tagline: "A simple start for consistent social content.", price: 20000, minutes: 60, locations: 1, revisions: 1, delivery: "7–10 business days", includes: ["1 edited vertical video", "Color grading", "Social-ready 9:16 delivery"] },
  { id: "content-essential", category: "content", name: "The Essential", tagline: "A sharp introduction. A lasting impression.", price: 45000, minutes: 60, locations: 1, revisions: 2, delivery: "7–10 business days", includes: ["1-hour guided content session", "3 edited vertical videos (15–30 sec)", "Color grading + sound effects", "Social-ready 9:16 delivery"] },
  { id: "content-signature", category: "content", name: "The Signature", tagline: "More stories. One unmistakable identity.", price: 85000, minutes: 120, locations: 1, revisions: 3, delivery: "7–10 business days", featured: true, includes: ["2-hour creative content session", "6 edited vertical videos (15–45 sec)", "Creative direction + shot planning", "Color grade + licensed music", "Captioned, social-ready delivery"] },
  { id: "content-campaign", category: "content", name: "The Campaign", tagline: "A complete content world, built around you.", price: 150000, minutes: 240, locations: 2, revisions: 4, delivery: "10–15 business days", includes: ["4-hour production session", "10 edited vertical videos (15–60 sec)", "Pre-production creative call", "Two-location visual storytelling", "Color, sound + licensed music planning", "Captioned delivery"] },
  ...musicPackages,
  { id: "brand-intro", category: "brand", name: "The Introduction", tagline: "Make your first impression mean something.", price: 100000, minutes: 180, locations: 1, revisions: 2, delivery: "14–21 business days", includes: ["3-hour on-location session", "One 45–60 second brand film", "Creative call + interview planning", "Color grade, sound + licensed music"] },
  { id: "brand-story", category: "brand", name: "The Brand Story", tagline: "For the things a photograph cannot say.", price: 220000, minutes: 360, locations: 2, revisions: 2, delivery: "21–28 business days", featured: true, includes: ["6-hour production day", "One 90–120 second brand film", "Interview + cinematic B-roll", "Two 15-second social cutdowns", "Creative direction through delivery"] },
  { id: "event-highlight", category: "events", name: "The Highlight", tagline: "All the feeling. Every defining moment.", price: 80000, minutes: 180, locations: 1, revisions: 1, delivery: "10–14 business days", includes: ["3-hour event coverage", "One 60–90 second highlight film", "Atmosphere, details + key moments", "Color grade + licensed soundtrack"] },
  { id: "event-afterfilm", category: "events", name: "The Afterfilm", tagline: "Let them feel like they were there.", price: 150000, minutes: 300, locations: 1, revisions: 2, delivery: "14–21 business days", featured: true, includes: ["5-hour event coverage", "One 2–3 minute cinematic afterfilm", "One 30-second vertical teaser", "Sound design + color grade", "Planning call for your run of show"] },
  { id: "estate-tour", category: "estate", name: "The Property Film", tagline: "Let your next listing speak for itself.", price: 65000, minutes: 120, locations: 1, revisions: 1, delivery: "5–7 business days", includes: ["2-hour property shoot", "One 60–90 second property film", "Interior + exterior coverage", "Color grade + licensed music"] },
  { id: "custom-production", category: "custom", name: "Your Next Big Idea", tagline: "Built around the story you want to tell.", price: 0, minutes: 0, locations: 0, revisions: 0, delivery: "Agreed with your proposal", inquiryOnly: true, includes: ["Multi-day productions + campaigns", "Complex concepts + larger crews", "Travel + multiple locations", "A tailored scope and proposal"] },
  { id: "booking-test", category: "custom", name: "Booking Test — $1", tagline: "Temporary internal test package for the live booking flow.", price: 100, minutes: 30, locations: 1, revisions: 0, delivery: "Test only", includes: ["30-minute test slot", "Live Stripe payment", "Cal.com confirmation"] },
];
export const bookingPackages: BookingPackage[] = packageDefinitions.map((pkg) => ({ ...pkg, deposit: depositFor(pkg.price) }));
export const bookingAddons = [
  { id: "vertical-cut", name: "Extra vertical cut", description: "One additional 15–30 second edit from your session.", price: 12500 },
  { id: "photo-frames", name: "Frame collection", description: "10 color-graded still frames pulled from your footage.", price: 7500 },
  { id: "extra-revision", name: "Extra revision round", description: "One additional round of consolidated edit feedback.", price: 10000 },
  { id: "music-concept", name: "Script / concept development", description: "Develop the script or concept for your music video.", price: 7500 },
];
export function eligibleAddonsFor(pkg: BookingPackage) {
  if (pkg.addonIds) return bookingAddons.filter((addon) => pkg.addonIds!.includes(addon.id));
  if (pkg.category === "music") return [];
  return bookingAddons.filter((addon) => !addon.id.startsWith("music-"));
}
// Every package asks the same details question.
export const projectQuestion = { label: "Tell us about your project and vision", placeholder: "The idea, mood, references or links, and anything we should know about the shoot." };
export const categoryImages: Record<BookingCategory, string> = { content: "/images/social-media/andy-promo.webp", music: "/images/medomina-1.webp", brand: "/images/branding/blind.webp", events: "/images/aftermovies/saii-2.webp", estate: "/images/about/directing-bts.webp", custom: "/images/about/directing-bts.webp" };
export function money(cents: number) {
  const exact = cents % 100 !== 0;
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: exact ? 2 : 0, maximumFractionDigits: exact ? 2 : 0 }).format(cents / 100);
}
export type PaymentOption = "deposit" | "full";
export function quoteFor(packageId: string, addonIds: string[], paymentOption: PaymentOption = "deposit", promotion?: PublicPromotion | null, packages = bookingPackages) {
  const pkg = packages.find((item) => item.id === packageId);
  const eligible = pkg ? eligibleAddonsFor(pkg) : [];
  if (!pkg || pkg.inquiryOnly || new Set(addonIds).size !== addonIds.length || addonIds.some((id) => !eligible.some((item) => item.id === id))) throw new Error("Choose a valid package and add-ons.");
  const addons = eligible.filter((item) => addonIds.includes(item.id));
  if (promotion && (promotion.packageId !== pkg.id || promotion.discountedPrice <= 0 || promotion.discountedPrice >= promotion.originalPrice)) throw new Error("Choose a valid package and add-ons.");
  const packagePrice = promotion?.discountedPrice ?? pkg.price;
  const originalPrice = promotion?.originalPrice ?? pkg.price;
  const deposit = depositFor(packagePrice, pkg.depositPercent ?? DEPOSIT_SHARE * 100);
  const total = packagePrice + addons.reduce((sum, item) => sum + item.price, 0);
  // dueNow is what Cal charges at booking: the fixed deposit, or everything when paying in full.
  const dueNow = paymentOption === "full" ? total : deposit;
  return { pkg, addons, total, originalPrice, packagePrice, savings: originalPrice - packagePrice, promotion: promotion ?? null, deposit, paymentOption, dueNow, balance: total - dueNow };
}
