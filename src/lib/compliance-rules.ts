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
  frequency: "Monthly" | "Quarterly" | "Annual" | "SelfEmployed",
  gstYearEnd?: string | null
): Period[] {
  const year = fye.getUTCFullYear();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const yearEndMonth = gstYearEnd ? monthNames.findIndex((m) => m.toLowerCase() === gstYearEnd.toLowerCase()) + 1 : 0;
  if (frequency === "Monthly") {
    const periods: Period[] = [];
    for (let m = 0; m < 12; m++) {
      const periodStart = utc(year, m + 1, 1);
      // last day of month m: day 0 of month m+1
      const periodEnd = utc(year, m + 2, 0);
      // Due: last day of month following the period (day 0 of the month after that)
      const dueMonth1 = m + 3; // 1-based, could be 13-14
      const dueY = year + Math.floor((dueMonth1 - 1) / 12);
      const dueM1 = ((dueMonth1 - 1) % 12) + 1;
      const due = utc(dueY, dueM1, 0);
      periods.push({ periodStart, periodEnd, filingDue: due, paymentDue: due });
    }
    return periods;
  }
  if (frequency === "Quarterly") {
    const quarterEnds = yearEndMonth > 0
      ? [1, 2, 3, 4].map((q) => {
          const endMonth = ((yearEndMonth + q * 3 - 1) % 12) + 1;
          const endYear = year - (endMonth > yearEndMonth ? 1 : 0);
          // utc(y, m, 0) is the last day of month m-1, so pass endMonth+1 to get
          // the last day of endMonth (e.g., endMonth 9 -> utc(..., 10, 0) = Sep 30).
          return utc(endYear, endMonth + 1, 0);
        })
      : [utc(year, 3, 31), utc(year, 6, 30), utc(year, 9, 30), utc(year, 12, 31)];
    return quarterEnds.map((periodEnd) => {
      const periodStart = addMonths(periodEnd, -2);
      periodStart.setUTCDate(1);
      // Due: last day of the month following the quarter end (day 0 of the month after that)
      const dueM1 = periodEnd.getUTCMonth() + 2; // 1-based month after the quarter end
      const dueY = periodEnd.getUTCFullYear() + Math.floor(dueM1 / 12);
      const due = utc(dueY, (dueM1 % 12) + 1, 0);
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
  if (yearEndMonth > 0) {
    // GST year-end anchored: the period runs from the day after the prior
    // year-end through this year's year-end (e.g., Jul 1 to Jun 30 for a
    // June year-end). `fye` is the year-end date in the target year.
    const periodEnd = fye;
    const periodStart = addDays(addMonths(periodEnd, -12), 1);
    const due = addMonths(periodEnd, 3);
    return [{ periodStart, periodEnd, filingDue: due, paymentDue: due }];
  }
  const periodStart = addMonths(fye, 1);
  periodStart.setUTCDate(1);
  periodStart.setUTCHours(0, 0, 0, 0);
  const periodEnd = fye;
  const due = addMonths(fye, 3);
  return [{ periodStart, periodEnd, filingDue: due, paymentDue: due }];
}

/**
 * Monthly HST periods over a rolling 12-month window starting at `start`
 * (typically the first of the current month). Mirrors the due-date math in
 * hstPeriods' Monthly branch (due = last day of the month following the
 * period) but anchored to the window instead of a calendar year, so the
 * schedule tracks the current + next 12 months regardless of gstYearEnd/FYE.
 */
export function hstMonthlyPeriods(start: Date): Period[] {
  const periods: Period[] = [];
  for (let i = 0; i < 12; i++) {
    const m = new Date(start);
    m.setUTCMonth(m.getUTCMonth() + i);
    const year = m.getUTCFullYear();
    const periodMonth = m.getUTCMonth(); // 0-based
    const periodStart = utc(year, periodMonth + 1, 1);
    const periodEnd = utc(year, periodMonth + 2, 0);
    const dueMonth1 = periodMonth + 3; // 1-based month after the following month
    const dueY = year + Math.floor((dueMonth1 - 1) / 12);
    const dueM1 = ((dueMonth1 - 1) % 12) + 1;
    const due = utc(dueY, dueM1, 0);
    periods.push({ periodStart, periodEnd, filingDue: due, paymentDue: due });
  }
  return periods;
}

/** Ontario Annual Return: due 6 months after taxation year-end. */
export function ontarioAnnualReturn(fye: Date): { filingDue: Date } {
  return { filingDue: addMonths(fye, 6) };
}

/** Federal Annual Return: due 60 days after incorporation anniversary. */
export function federalAnnualReturn(incorporationDate: Date): { filingDue: Date } {
  const today = new Date();

  // Create the anniversary date in the current year
  // (same month and day as incorporationDate, but current year)
  const anniversary = new Date(Date.UTC(
    today.getUTCFullYear(),
    incorporationDate.getUTCMonth(),
    incorporationDate.getUTCDate()
  ));

  // If this year's anniversary has already passed, use next year's
  if (anniversary.getTime() < today.getTime()) {
    anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  }

  // Filing is due 60 days after the anniversary
  return { filingDue: addDays(anniversary, 60) };
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
export function payrollRunPeriods(
  start: Date,
  frequency: "Weekly" | "Bi-Weekly" | "Semi-Monthly" | "Monthly"
): Period[] {
  const out: Period[] = [];
  const add = (periodStart: Date, periodEnd: Date) =>
    out.push({ periodStart, periodEnd, filingDue: periodEnd, paymentDue: periodEnd });
  if (frequency === "Weekly" || frequency === "Bi-Weekly") {
    const count = frequency === "Weekly" ? 52 : 26;
    const days = frequency === "Weekly" ? 7 : 14;
    for (let i = 0; i < count; i++) {
      const periodStart = addDays(start, i * days);
      add(periodStart, addDays(periodStart, days - 1));
    }
    return out;
  }
  for (let i = 0; i < 12; i++) {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + i, 1));
    const year = month.getUTCFullYear();
    const monthIndex = month.getUTCMonth();
    const last = new Date(Date.UTC(year, monthIndex + 1, 0));
    add(new Date(month), new Date(Date.UTC(year, monthIndex, 15)));
    if (frequency === "Semi-Monthly") {
      add(new Date(Date.UTC(year, monthIndex, 16)), last);
    }
    if (frequency === "Monthly") {
      out[out.length - 1] = { periodStart: new Date(month), periodEnd: last, filingDue: last, paymentDue: last };
    }
  }
  return out;
}

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
