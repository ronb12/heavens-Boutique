/** Shared selects for checkout, address book, and admin catalog — avoids free-text typos on finite sets. */

export type LabeledOption = { value: string; label: string };

export const SELECT_FIELD_CLASS =
  "h-11 rounded-2xl border border-black/10 bg-white px-4";

/** ISO 3166-1 alpha-2 — curated for shipping; extend as needed. */
export const COUNTRY_OPTIONS: LabeledOption[] = [
  { value: "US", label: "United States" },
  { value: "CA", label: "Canada" },
  { value: "MX", label: "Mexico" },
  { value: "PR", label: "Puerto Rico" },
  { value: "GB", label: "United Kingdom" },
  { value: "IE", label: "Ireland" },
  { value: "FR", label: "France" },
  { value: "DE", label: "Germany" },
  { value: "IT", label: "Italy" },
  { value: "ES", label: "Spain" },
  { value: "AU", label: "Australia" },
  { value: "NZ", label: "New Zealand" },
  { value: "JP", label: "Japan" },
  { value: "KR", label: "South Korea" },
  { value: "CN", label: "China" },
];

const COUNTRY_ALIASES: Record<string, string> = {
  usa: "US",
  "united states": "US",
  "united states of america": "US",
  america: "US",
  uk: "GB",
  england: "GB",
};

export function coerceCountryCode(raw: string | undefined | null): string {
  const s = String(raw ?? "").trim();
  if (!s) return "US";
  const upper = s.toUpperCase();
  if (/^[A-Z]{2}$/i.test(s) && upper.length === 2) return upper;
  const alias = COUNTRY_ALIASES[s.toLowerCase()];
  if (alias) return alias;
  return upper.length === 2 ? upper : "US";
}

/** USPS-style two-letter codes (includes DC). */
export const US_STATE_OPTIONS: LabeledOption[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "DC", label: "District of Columbia" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
];

export function coerceUsStateCode(raw: string | undefined | null): string {
  const t = String(raw ?? "").trim();
  if (!t) return "";
  const upper = t.toUpperCase();
  if (US_STATE_OPTIONS.some((s) => s.value === upper)) return upper;
  const found = US_STATE_OPTIONS.find((s) => s.label.toLowerCase() === t.toLowerCase());
  return found?.value ?? t;
}

/** Product categories — backend accepts any string; presets reduce inconsistency. */
export const PRODUCT_CATEGORY_OPTIONS: LabeledOption[] = [
  { value: "general", label: "General" },
  { value: "dresses", label: "Dresses" },
  { value: "tops", label: "Tops" },
  { value: "bottoms", label: "Bottoms" },
  { value: "outerwear", label: "Outerwear" },
  { value: "activewear", label: "Activewear" },
  { value: "accessories", label: "Accessories" },
  { value: "jewelry", label: "Jewelry" },
  { value: "handbags", label: "Handbags" },
  { value: "shoes", label: "Shoes" },
  { value: "kids", label: "Kids" },
  { value: "sale", label: "Sale" },
];

export const CUSTOM_CATEGORY_VALUE = "__custom__";

/** Variant sizes common for apparel — inventory may still use arbitrary strings via custom. */
export const VARIANT_SIZE_OPTIONS: LabeledOption[] = [
  { value: "XXS", label: "XXS" },
  { value: "XS", label: "XS" },
  { value: "S", label: "S" },
  { value: "M", label: "M" },
  { value: "L", label: "L" },
  { value: "XL", label: "XL" },
  { value: "XXL", label: "XXL" },
  { value: "0", label: "0" },
  { value: "2", label: "2" },
  { value: "4", label: "4" },
  { value: "6", label: "6" },
  { value: "8", label: "8" },
  { value: "10", label: "10" },
  { value: "12", label: "12" },
  { value: "14", label: "14" },
  { value: "16", label: "16" },
  { value: "18", label: "18" },
  { value: "1X", label: "1X" },
  { value: "2X", label: "2X" },
  { value: "3X", label: "3X" },
  { value: "OS", label: "One size (OS)" },
];

export const CUSTOM_SIZE_VALUE = "__custom__";

/** Admin return workflow — matches backend `returns.status`. */
export const RETURN_STATUS_OPTIONS: LabeledOption[] = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "completed", label: "Completed" },
];
