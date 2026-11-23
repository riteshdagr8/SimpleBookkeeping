/**
 * Historical review groups. The review is marked per group per fiscal year,
 * not per filing type: one cell covers every filing the group produces for that
 * year (four HST quarters, 52 weekly payroll runs, ...).
 *
 * The stored HistoricalReview.filingType holds the group key below. Legacy
 * values (T2, HST, Payroll, T4, T4A, T5) are mapped to a group on read.
 */

import {
  annualReturnFilingTypes,
  incomeTaxFilingType,
  infoReturnFilingTypes,
  salesTaxFilingTypes,
} from "./obligation-matrix";
import type { ComplianceConfig } from "./obligation-matrix";

/**
 * The filing types a review group covers for a client, from its settings.
 * Used to scope cancellation to the group whose review cell changed.
 */
export function filingTypesForReviewGroup(config: ComplianceConfig, group: ReviewGroup): string[] {
  switch (group) {
    case "IncomeTaxes":
      return [incomeTaxFilingType(config.entityType)];
    case "SalesTax":
      return salesTaxFilingTypes(config.incorporationJurisdiction);
    case "Payroll":
      return ["PayrollProcessing"];
    case "FederalAR":
      return annualReturnFilingTypes(config).filter((t) => t === "FederalAnnualReturn");
    case "ProvincialAR":
      return annualReturnFilingTypes(config).filter((t) => t === "ProvincialAnnualReturn");
    case "InformationReturns":
      return infoReturnFilingTypes(config);
  }
}

export const REVIEW_GROUPS = [
  "IncomeTaxes",
  "SalesTax",
  "Payroll",
  "FederalAR",
  "ProvincialAR",
  "InformationReturns",
] as const;

export type ReviewGroup = (typeof REVIEW_GROUPS)[number];

export const REVIEW_GROUP_LABELS: Record<ReviewGroup, string> = {
  IncomeTaxes: "Income Taxes",
  SalesTax: "Sales Tax",
  Payroll: "Payroll",
  FederalAR: "Federal AR",
  ProvincialAR: "Provincial AR",
  InformationReturns: "Information Returns",
};

/** Map a stored review value (group key or legacy filing type) to its group. */
export function toReviewGroup(stored: string): ReviewGroup | null {
  if ((REVIEW_GROUPS as readonly string[]).includes(stored)) return stored as ReviewGroup;
  switch (stored) {
    case "T2":
    case "T1":
    case "T5013":
    case "T3":
      return "IncomeTaxes";
    case "HST":
    case "GST":
    case "GSTQST":
    case "PST":
    case "RST":
      return "SalesTax";
    case "Payroll":
    case "PayrollProcessing":
    case "PayrollRemittance":
      return "Payroll";
    case "FederalAnnualReturn":
      return "FederalAR";
    case "ProvincialAnnualReturn":
      return "ProvincialAR";
    case "T4":
    case "T4A":
    case "T5":
    case "T3Slips":
      return "InformationReturns";
    default:
      return null;
  }
}

/** The groups that apply to a client, from its compliance settings. */
export function reviewGroupsForClient(config: ComplianceConfig): Set<ReviewGroup> {
  const set = new Set<ReviewGroup>(["IncomeTaxes"]);
  if (config.hstApplicable && config.hstFrequency && salesTaxFilingTypes(config.incorporationJurisdiction).length > 0) {
    set.add("SalesTax");
  }
  if (config.payrollApplicable) set.add("Payroll");
  for (const t of annualReturnFilingTypes(config)) {
    if (t === "FederalAnnualReturn") set.add("FederalAR");
    if (t === "ProvincialAnnualReturn") set.add("ProvincialAR");
  }
  // Info returns apply to every entity type the matrix knows about.
  set.add("InformationReturns");
  return set;
}
