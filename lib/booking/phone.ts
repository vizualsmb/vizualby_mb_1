// Phone parsing is intentionally provider-neutral. The booking API stores an
// E.164 value so any delivery provider can use it without reformatting.
export function normalizePhone(value: string, defaultCountryCode = process.env.SMS_DEFAULT_COUNTRY_CODE || "1") {
  const compact = value.trim().replace(/^tel:/i, "").replace(/[\s().-]/g, "");
  const digits = compact.startsWith("+") ? compact.slice(1) : compact;
  const normalized = compact.startsWith("+") ? digits : digits.length === 10 ? `${defaultCountryCode}${digits}` : digits;
  return /^[1-9]\d{7,14}$/.test(normalized) ? `+${normalized}` : null;
}
