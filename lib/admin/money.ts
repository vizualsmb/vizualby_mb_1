const whole = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const exact = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
// Integer cents in, display dollars out. Whole dollars unless cents matter.
export const usd = (cents: number) => (cents % 100 === 0 ? whole : exact).format(cents / 100);
export const usdCompact = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", notation: "compact", maximumFractionDigits: 1 }).format(cents / 100);
// "12.50" -> 1250. Rejects anything that is not a plain positive amount.
export function parseCents(input: FormDataEntryValue | null) {
  const s = String(input ?? "").replace(/[$,\s]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  return Math.round(Number(s) * 100);
}
