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

/**
 * The last day of the month `months` months after `d`'s month.
 *
 * Canadian filing deadlines land on a month boundary ("6 months after the
 * fiscal year-end", "the last day of the month following the quarter"). Plain
 * `addMonths` preserves the day-of-month, which is only right when both months
 * have the same length — e.g. a Feb 28 year-end + 3 months would give May 28
 * instead of May 31. Use this wherever a deadline is meant to be a month-end.
 */
function addMonthsMonthEnd(d: Date, months: number): Date {
  const target = d.getUTCMonth() + months;
  const year = d.getUTCFullYear() + Math.floor(target / 12);
  const month0 = ((target % 12) + 12) % 12;
  // Last day of the month at 0-based index month0: day 0 of the following month.
  return new Date(Date.UTC(year, month0 + 1, 0));
}

/** The last day of the month containing `d`. */
function monthEnd(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d.getTime());
  r.setUTCDate(r.getUTCDate() + days);
  return r;
}

export function utc(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d));
}

/** T2 Corporate tax: filing due 6 months after FYE; balance due 2 (or 3) months after FYE.
 *  Both deadlines land on the last day of the target month. */
export function t2Deadlines(
  fye: Date,
  threeMonthEligible: boolean
): { filingDue: Date; paymentDue: Date } {
  return {
    filingDue: addMonthsMonthEnd(fye, 6),
    paymentDue: addMonthsMonthEnd(fye, threeMonthEligible ? 3 : 2),
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
    // Period runs the calendar year ending at the Dec 31 year-end.
    const periodStart = utc(fye.getUTCFullYear(), 1, 1);
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
    const due = addMonthsMonthEnd(periodEnd, 3);
    return [{ periodStart, periodEnd, filingDue: due, paymentDue: due }];
  }
  // A fiscal year-end is a month-end, so the period runs from the day after the
  // previous year-end through this one. No gstYearEnd here, so the month and day
  // come from the FYE itself.
  const periodEnd = monthEnd(fye);
  const periodStart = addDays(addMonths(periodEnd, -12), 1);
  const due = addMonthsMonthEnd(periodEnd, 3);
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

export interface SalesTaxPeriodsParams {
  windowStart: Date;
  fye: Date;
  frequency: "Monthly" | "Quarterly" | "Annual" | "SelfEmployed";
  gstYearEnd?: string | null;
  entityType: string | null;
}

/**
 * Sales-tax periods for a frequency, independent of jurisdiction. The caller
 * assigns the resulting periods to the jurisdiction's filing types (HST / GST /
 * GST/QST / PST / RST). Monthly is anchored to the rolling window. Quarterly
 * and Annual (corporation) generate periods anchored to the window's start
 * month and the next, so the schedule covers the window. The annual
 * self-employed rule (Apr 30 payment / Jun 15 filing) applies to
 * Self-Employed and Individual entities with a Dec-31 FYE.
 */
export function salesTaxPeriods(p: SalesTaxPeriodsParams): Period[] {
  if (p.frequency === "Monthly") return hstMonthlyPeriods(p.windowStart);
  if (
    p.frequency === "SelfEmployed" ||
    (p.frequency === "Annual" && (p.entityType === "Self-Employed" || p.entityType === "Individual"))
  ) {
    return hstPeriods(p.fye, "SelfEmployed", p.gstYearEnd);
  }
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const gstMonth = p.gstYearEnd ? monthNames.findIndex((m) => m.toLowerCase() === p.gstYearEnd!.toLowerCase()) + 1 : 0;
  const anchorYear = gstMonth > 0
    ? p.windowStart.getUTCFullYear() + (p.windowStart.getUTCMonth() + 1 > gstMonth ? 1 : 0)
    : p.fye.getUTCFullYear();
  const out: Period[] = [];
  for (const yearOffset of [0, 1]) {
    const targetFye = gstMonth > 0
      ? utc(anchorYear + yearOffset, gstMonth + 1, 0)
      : new Date(Date.UTC(p.fye.getUTCFullYear() + yearOffset, p.fye.getUTCMonth(), p.fye.getUTCDate()));
    out.push(...hstPeriods(targetFye, p.frequency, p.gstYearEnd));
  }
  return out;
}

/** Ontario Annual Return: due the last day of the month 6 months after the year-end. */
export function ontarioAnnualReturn(fye: Date): { filingDue: Date } {
  return { filingDue: addMonthsMonthEnd(fye, 6) };
}

/** The incorporation anniversary in the current year; if already passed, next year. */
export function nextAnniversary(incorporationDate: Date, now = new Date()): Date {
  const anniversary = new Date(Date.UTC(
    now.getUTCFullYear(),
    incorporationDate.getUTCMonth(),
    incorporationDate.getUTCDate()
  ));
  if (anniversary.getTime() < now.getTime()) {
    anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  }
  return anniversary;
}

/** Federal Annual Return: due 60 days after incorporation anniversary. */
export function federalAnnualReturn(incorporationDate: Date): { filingDue: Date } {
  return { filingDue: addDays(nextAnniversary(incorporationDate), 60) };
}

/**
 * T1 personal tax return deadlines. Work year = the calendar year of the FYE.
 * Self-Employed: payment due Apr 30, filing due Jun 15 of the following year.
 * Individual: both filing and payment due Apr 30 of the following year.
 */
export function t1Deadlines(
  workYear: number,
  isIndividual: boolean
): { filingDue: Date; paymentDue: Date } {
  if (isIndividual) {
    return { filingDue: utc(workYear + 1, 4, 30), paymentDue: utc(workYear + 1, 4, 30) };
  }
  return { filingDue: utc(workYear + 1, 6, 15), paymentDue: utc(workYear + 1, 4, 30) };
}

/** T5013 partnership return: filing due Mar 31 of the following year; no payment. */
export function t5013Deadlines(workYear: number): { filingDue: Date; paymentDue: null } {
  return { filingDue: utc(workYear + 1, 3, 31), paymentDue: null };
}

/** T3 trust return: filing and payment due 90 days after the trust tax year-end. */
export function t3Deadlines(fye: Date): { filingDue: Date; paymentDue: Date } {
  return { filingDue: addDays(fye, 90), paymentDue: addDays(fye, 90) };
}

/**
 * Provincial Annual Return deadline by jurisdiction:
 *  - ON, QC: 6 months after FYE
 *  - BC, NS, NL: incorporation anniversary + 60 days
 *  - AB, SK, MB, NB, YT, NT, NU: last day of the month following the anniversary month
 *  - PE: last day of the anniversary month
 * Anniversary-based provinces require incorporationDate (returns null if absent).
 */
export function provincialAnnualReturnDeadline(
  jurisdiction: string | null,
  fye: Date,
  incorporationDate: Date | null,
  now = new Date()
): Date | null {
  if (jurisdiction === "ON" || jurisdiction === "QC") return addMonthsMonthEnd(fye, 6);
  if (!incorporationDate) return null;
  const anniversary = nextAnniversary(incorporationDate, now);
  if (jurisdiction === "BC" || jurisdiction === "NS" || jurisdiction === "NL") {
    return addDays(anniversary, 60);
  }
  if (jurisdiction === "PE") {
    // last day of the anniversary month
    return utc(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 2, 0);
  }
  // AB, SK, MB, NB, YT, NT, NU: last day of the month following the anniversary month
  return utc(anniversary.getUTCFullYear(), anniversary.getUTCMonth() + 3, 0);
}

/** T4/T4A/T5 Information Returns: due the last day of February of the year following the work year. */
export function infoReturnDeadlines(workYear: number): { filingDue: Date } {
  // March day 0 = last day of February (28 or 29 in leap years).
  return { filingDue: utc(workYear + 1, 3, 0) };
}

/**
 * Firm-wide payroll cycle. Weekly and Bi-Weekly periods always end on a Friday,
 * and every cycle is counted from one fixed reference period end, so the same
 * dates come out no matter when the schedule is generated. A weekly period is
 * the 7 days Saturday to Friday; a bi-weekly period is the 14 days ending on a
 * Friday, 14 days after the previous one.
 *
 * Semi-Monthly and Monthly are calendar-based and don't use this cycle.
 */
export const PAYROLL_CYCLE_REFERENCE_END = utc(2026, 11, 13); // a Friday
export const PAYROLL_CYCLE_DAYS = { Weekly: 7, "Bi-Weekly": 14 } as const;

/** Payroll cycle runs (Weekly / Bi-Weekly) whose period ends fall in [from, to]. */
export function payrollCycleRuns(
  from: Date,
  to: Date,
  frequency: "Weekly" | "Bi-Weekly"
): Period[] {
  const days = PAYROLL_CYCLE_DAYS[frequency];
  const out: Period[] = [];
  const step = days * 24 * 60 * 60 * 1000;
  const k0 = Math.floor((from.getTime() - PAYROLL_CYCLE_REFERENCE_END.getTime()) / step);
  for (let k = k0; k <= k0 + 60; k++) {
    const periodEnd = addDays(PAYROLL_CYCLE_REFERENCE_END, k * days);
    if (periodEnd.getTime() < from.getTime()) continue;
    if (periodEnd.getTime() > to.getTime()) break;
    const periodStart = addDays(periodEnd, -(days - 1));
    out.push({ periodStart, periodEnd, filingDue: periodEnd, paymentDue: periodEnd });
  }
  return out;
}

/**
 * Payroll processing run periods for a pay frequency, for the 12 months from
 * `start` (start of a month). Weekly and Bi-Weekly come from the fixed cycle
 * above; Semi-Monthly and Monthly return their 1st-15th / 16th-end (or
 * whole-month) runs.
 */
export function payrollRunPeriods(
  start: Date,
  frequency: "Weekly" | "Bi-Weekly" | "Semi-Monthly" | "Monthly"
): Period[] {
  const out: Period[] = [];
  const add = (periodStart: Date, periodEnd: Date) =>
    out.push({ periodStart, periodEnd, filingDue: periodEnd, paymentDue: periodEnd });
  if (frequency === "Weekly" || frequency === "Bi-Weekly") {
    const end = new Date(start);
    end.setUTCFullYear(end.getUTCFullYear() + 1);
    end.setUTCDate(end.getUTCDate() + 14);
    return payrollCycleRuns(start, end, frequency);
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
