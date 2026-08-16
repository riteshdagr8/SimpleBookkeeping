/**
 * Canadian incorporation / registry jurisdictions.
 *
 * Display full names in the UI; store the short codes below. `Federal` is the
 * CBCA jurisdiction (Federal Annual Return); the rest are provincial/territorial
 * registry jurisdictions (Provincial Annual Return) plus the sales-tax buckets.
 */

export const JURISDICTIONS = [
  { code: "Federal", label: "Federal (Canada)" },
  { code: "AB", label: "Alberta" },
  { code: "BC", label: "British Columbia" },
  { code: "MB", label: "Manitoba" },
  { code: "NB", label: "New Brunswick" },
  { code: "NL", label: "Newfoundland and Labrador" },
  { code: "NT", label: "Northwest Territories" },
  { code: "NS", label: "Nova Scotia" },
  { code: "NU", label: "Nunavut" },
  { code: "ON", label: "Ontario" },
  { code: "PE", label: "Prince Edward Island" },
  { code: "QC", label: "Quebec" },
  { code: "SK", label: "Saskatchewan" },
  { code: "YT", label: "Yukon" },
] as const;

export const JURISDICTION_CODES = JURISDICTIONS.map((j) => j.code);

/** All provincial/territorial codes (everything except Federal). */
export const PROVINCE_CODES = JURISDICTIONS.filter((j) => j.code !== "Federal").map((j) => j.code);

// Sales-tax buckets (used by the obligation generator).
export const HARMONIZED_PROVINCES = ["ON", "NB", "NS", "NL", "PE"] as const;
export const NON_PST_REGIONS = ["AB", "NT", "NU", "YT"] as const;
export const SEPARATE_PST_PROVINCES = ["BC", "SK", "MB"] as const;

/** Legacy full-name values (and their codes) → canonical codes. */
const JURISDICTION_ALIASES: Record<string, string> = {
  "Federal (Canada)": "Federal",
  Federal: "Federal",
  Alberta: "AB",
  "British Columbia": "BC",
  Manitoba: "MB",
  "New Brunswick": "NB",
  "Newfoundland and Labrador": "NL",
  Newfoundland: "NL",
  "Northwest Territories": "NT",
  "Nova Scotia": "NS",
  Nunavut: "NU",
  Ontario: "ON",
  "Prince Edward Island": "PE",
  Quebec: "QC",
  Saskatchewan: "SK",
  Yukon: "YT",
};

/**
 * Normalize a stored jurisdiction value to its canonical code. Accepts codes
 * and legacy full names; returns null for unknown/empty values. Used by the
 * one-time data backfill and defensively by form loading.
 */
export function normalizeJurisdiction(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  if ((JURISDICTION_CODES as readonly string[]).includes(t)) return t;
  return JURISDICTION_ALIASES[t] ?? null;
}
