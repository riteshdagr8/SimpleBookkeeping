/**
 * Employee pay frequencies. A client can have several (for example Weekly and
 * Monthly for two groups of staff). They are stored on Client.payrollFrequency
 * as a comma-separated list, e.g. "Weekly,Monthly".
 *
 * Payroll Processing rows don't store their frequency. It is derived from the
 * row's period, which is generated from the same rules, so the two always agree.
 */

export const PAY_FREQUENCIES = ["Weekly", "Bi-Weekly", "Semi-Monthly", "Monthly"] as const;
export type PayFrequency = (typeof PAY_FREQUENCIES)[number];

const DAY_MS = 24 * 60 * 60 * 1000;

/** Split the stored value into known frequencies. Unknown values (such as legacy "NA") are dropped. */
export function parsePayFrequencies(stored: string | null | undefined): PayFrequency[] {
  if (!stored) return [];
  const known = new Set<string>(PAY_FREQUENCIES);
  return stored
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is PayFrequency => known.has(s));
}

/** Store a list of frequencies. An empty list stores null. */
export function joinPayFrequencies(list: readonly string[] | null | undefined): string | null {
  const clean = PAY_FREQUENCIES.filter((f) => list?.includes(f));
  return clean.length > 0 ? clean.join(",") : null;
}

/**
 * The frequency a Payroll Processing period belongs to, from its start and end
 * (UTC calendar dates). Returns null if the period matches no frequency.
 */
export function frequencyForPeriod(start: Date, end: Date): PayFrequency | null {
  const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
  const endsMonth = end.getUTCDate() === new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth() + 1, 0)).getUTCDate();
  // Semi-monthly halves are the 1st–15th and the 16th–month-end. Checked first,
  // because the second half is 14 days in a leap-year February.
  if ((start.getUTCDate() === 1 && end.getUTCDate() === 15) || (start.getUTCDate() === 16 && endsMonth)) {
    return "Semi-Monthly";
  }
  if (days === 7) return "Weekly";
  if (days === 14) return "Bi-Weekly";
  if (start.getUTCDate() === 1 && endsMonth && days >= 28) return "Monthly";
  return null;
}
