/**
 * Pure date math for Canadian corporate compliance deadlines.
 * No DB, no auth. Returns plain Date objects.
 *
 * All due dates are raw calendar dates — no weekend/holiday adjustment
 * (that's deferred to a later release).
 */

export interface Period {
  periodStart: Date;
  periodEnd: Date;
  filingDue: Date;
  paymentDue: Date;
}

function addMonths(d: Date, months: number): Date {
  const r = new Date(d.getTime());
  const day = r.getUTCDate();
  r.setUTCMonth(r.getUTCMonth() + months);
  // Guard against month-end overflow (e.g. Jan 31 + 1mo = Mar 3).
  if (r.getUTCDate() < day) r.setUTCDate(0);
  return r;
}

function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** T2 Corporate tax: filing due 6 months after FYE; balance due 2 (or 3) months after FYE. */
export function t2Deadlines(
  fye: Date,
  threeMonthEligible: boolean
): { filingDue: Date; paymentDue: Date } {
  return {
    filingDue: addMonths(fye, 6),
    paymentDue: addMonths(fye, threeMonthEligible ? 3 : 2),
  };
}

/** HST returns based on the fiscal year that the FYE closes. */
export function hstPeriods(
  fye: Date,
  frequency: "Monthly" | "Quarterly" | "Annual"
): Period[] {
  const year = fye.getUTCFullYear();
  if (frequency === "Monthly") {
    const periods: Period[] = [];
    for (let m = 0; m < 12; m++) {
      const periodStart = utc(year, m + 1, 1);
      // last day of month m: day 0 of month m+1
      const periodEnd = utc(year, m + 2, 0);
      const due = addMonths(periodEnd, 1);
      periods.push({ periodStart, periodEnd, filingDue: due, paymentDue: due });
    }
    return periods;
  }
  if (frequency === "Quarterly") {
    const quarterEnds = [
      utc(year, 3, 31),
      utc(year, 6, 30),
      utc(year, 9, 30),
      utc(year, 12, 31),
    ];
    return quarterEnds.map((periodEnd) => {
      const periodStart = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 1);
      const due = addMonths(periodEnd, 1);
      return { periodStart, periodEnd, filingDue: due, paymentDue: due };
    });
  }
  // Annual corporate HST
  const periodStart = addMonths(fye, 1);
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodEnd = fye;
  const due = addMonths(fye, 3);
  return [{ periodStart, periodEnd, filingDue: due, paymentDue: due }];
}

/** Ontario Annual Return: due 6 months after taxation year-end. */
export function ontarioAnnualReturn(fye: Date): { filingDue: Date } {
  return { filingDue: addMonths(fye, 6) };
}

/** Federal Annual Return: due 60 days after incorporation anniversary. */
export function federalAnnualReturn(incorporationDate: Date): { filingDue: Date } {
  const d = new Date(incorporationDate.getTime());
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  // 60 days after the anniversary = anniversary + 2 months (≈ 60.7 days)
  return { filingDue: addMonths(d, 2) };
}

/** T4/T4A/T5 Information Returns: due the last day of February of the year following the work year. */
export function infoReturnDeadlines(workYear: number): { filingDue: Date } {
  return { filingDue: utc(workYear + 1, 2, 28) };
}

/** Payroll remittance periods (CRA). */
export function payrollRemittancePeriods(
  fye: Date,
  remitterType: "Regular" | "Quarterly"
): Period[] {
  const year = fye.getUTCFullYear();
  if (remitterType === "Quarterly") {
    const quarterEnds = [
      utc(year, 3, 31),
      utc(year, 6, 30),
      utc(year, 9, 30),
      utc(year, 12, 31),
    ];
    return quarterEnds.map((periodEnd) => {
      const periodStart = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 1);
      // Quarterly remitter: due the 15th of the month after the quarter end
      const due = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 2, 15);
      return { periodStart, periodEnd, filingDue: due, paymentDue: due };
    });
  }
  // Regular (monthly)
  const periods: Period[] = [];
  for (let m = 0; m < 12; m++) {
    const periodEnd = utc(year, m + 1, 1);
    periodEnd.setUTCMonth(m + 1);
    periodEnd.setUTCDate(0);
    const periodStart = utc(year, m + 1, 1);
    const due = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 1, 15);
    periods.push({ periodStart, periodEnd, filingDue: due, paymentDue: due });
  }
  return periods;
}
