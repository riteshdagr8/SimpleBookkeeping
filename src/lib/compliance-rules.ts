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

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function utc(y: number, m: number, d: number): Date {
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
  frequency: "Monthly" | "Quarterly" | "Annual" | "SelfEmployed"
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
      // periodEnd.getUTCMonth() is 0-based; utc() takes 1-based months. Q1 ends Mar (2)
      // and starts Jan (1), so subtract 1: 2-1=1, utc(year,1,1)=Jan 1.
      const periodStart = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() - 1, 1);
      const due = addMonths(periodEnd, 1);
      return { periodStart, periodEnd, filingDue: due, paymentDue: due };
    });
  }
  if (frequency === "SelfEmployed") {
    // CRA rule: payment due April 30, filing due June 15 of the year after the FYE.
    // Only applies when the individual's FYE is Dec 31. Other FYEs use different
    // deadlines that the spec doesn't cover; return [] to avoid generating wrong dates.
    if (fye.getUTCMonth() !== 11 || fye.getUTCDate() !== 31) return [];
    const periodStart = addMonths(fye, 1);
    periodStart.setUTCDate(1);
    periodStart.setUTCHours(0, 0, 0, 0);
    return [
      {
        periodStart,
        periodEnd: fye,
        filingDue: utc(year + 1, 6, 15),
        paymentDue: utc(year + 1, 4, 30),
      },
    ];
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
  return { filingDue: addDays(d, 60) };
}

/** T4/T4A/T5 Information Returns: due the last day of February of the year following the work year. */
export function infoReturnDeadlines(workYear: number): { filingDue: Date } {
  // March day 0 = last day of February (28 or 29 in leap years).
  return { filingDue: utc(workYear + 1, 3, 0) };
}

/** Payroll remittance periods (CRA). */
export function payrollRemittancePeriods(
  fye: Date,
  remitterType: "Regular" | "Quarterly" | "Accelerated1" | "Accelerated2"
): Period[] {
  const year = fye.getUTCFullYear();
  // Accelerated remitter types are accepted in the form but the rule math is
  // not yet implemented — return [] so the generator skips these rows. The
  // schedule page surfaces a reminder.
  if (remitterType === "Accelerated1" || remitterType === "Accelerated2") {
    return [];
  }
  if (remitterType === "Quarterly") {
    const quarterEnds = [
      utc(year, 3, 31),
      utc(year, 6, 30),
      utc(year, 9, 30),
      utc(year, 12, 31),
    ];
    return quarterEnds.map((periodEnd) => {
      // Q1 ends Mar (month index 2) starts Jan (1-based Jan in utc() = 1).
      // 2 - 1 = 1 = January 1. Same off-by-one fix as HST quarterly.
      const periodStart = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() - 1, 1);
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
    // Due the 15th of the month after the period ends. For January period (month
    // index 0): 0 + 2 = 2 = Feb 15.
    const due = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 2, 15);
    periods.push({ periodStart, periodEnd, filingDue: due, paymentDue: due });
  }
  return periods;
}

/**
 * Rolling-window payroll remittance periods, anchored at `start` (start of a
 * month) and extending 12 months forward. Used by the schedule generator so
 * that "Generate schedule" produces the next 12 months of obligations
 * regardless of the client's FYE year.
 *
 * For Quarterly remitter, returns the 4 calendar quarter-ends that fall
 * within the window. For Monthly, returns 12 monthly periods starting at
 * `start`. For Accelerated1/2, returns [] (rule math not yet implemented).
 */
export function payrollRemittancePeriodsRolling(
  start: Date,
  remitterType: "Regular" | "Quarterly" | "Accelerated1" | "Accelerated2"
): Period[] {
  if (remitterType === "Accelerated1" || remitterType === "Accelerated2") {
    return [];
  }
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + 12);
  if (remitterType === "Quarterly") {
    // 4 quarter-ends per calendar year: Mar 31, Jun 30, Sep 30, Dec 31.
    // We iterate over the calendar year(s) that the window overlaps.
    const out: Period[] = [];
    for (let y = start.getUTCFullYear(); y <= end.getUTCFullYear(); y++) {
      for (const [m, day] of [
        [3, 31],
        [6, 30],
        [9, 30],
        [12, 31],
      ] as const) {
        const periodEnd = utc(y, m, day);
        if (periodEnd.getTime() < start.getTime()) continue;
        if (periodEnd.getTime() > end.getTime()) break;
        const periodStart = utc(y, m - 2, 1);
        const due = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 2, 15);
        out.push({ periodStart, periodEnd, filingDue: due, paymentDue: due });
      }
    }
    return out;
  }
  // Monthly
  const out: Period[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new Date(start);
    m.setUTCMonth(m.getUTCMonth() + i);
    const periodStart = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(m.getUTCFullYear(), m.getUTCMonth() + 1, 0));
    const due = utc(periodEnd.getUTCFullYear(), periodEnd.getUTCMonth() + 2, 15);
    out.push({ periodStart, periodEnd, filingDue: due, paymentDue: due });
  }
  return out;
}
