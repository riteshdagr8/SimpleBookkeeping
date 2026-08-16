/**
 * Entity- and jurisdiction-aware obligation matrix.
 *
 * Pure logic shared by:
 *   - the obligation generator (src/lib/services/obligations.ts)
 *   - the safe-edit confirmation flow (Phase 5)
 *   - the one-time data backfill (scripts/migrate-multi-entity.ts)
 *
 * Legacy rule: null/unknown `entityType` and `incorporationJurisdiction` are
 * treated as Corporation / default-HST respectively, so pre-existing clients
 * that never set these fields keep their current T2 / HST / T4/T4A/T5 rows.
 */

import {
  HARMONIZED_PROVINCES,
  NON_PST_REGIONS,
  PROVINCE_CODES,
  SEPARATE_PST_PROVINCES,
  jurisdictionLabel,
} from "./jurisdictions";

export const ENTITY_TYPES = [
  "Corporation",
  "Self-Employed",
  "Trust",
  "Individual",
  "Partnership",
] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

export interface ComplianceConfig {
  entityType: string | null;
  incorporationJurisdiction: string | null;
  incorporationDate: Date | null;
  hstApplicable: boolean;
  hstFrequency: string | null;
  payrollApplicable: boolean;
  payrollFrequency: string | null;
  remitterType: string | null;
}

/** Income-tax filing type for an entity (exactly one). */
export function incomeTaxFilingType(entityType: string | null): string {
  switch (entityType) {
    case "Self-Employed":
    case "Individual":
      return "T1";
    case "Partnership":
      return "T5013";
    case "Trust":
      return "T3";
    default:
      return "T2"; // Corporation or legacy null/unknown
  }
}

/** Sales-tax filing types for a jurisdiction (0..2; gated by the caller on hstApplicable+frequency). */
export function salesTaxFilingTypes(jurisdiction: string | null): string[] {
  if (!jurisdiction || jurisdiction === "Federal") return ["HST"];
  if ((HARMONIZED_PROVINCES as readonly string[]).includes(jurisdiction)) return ["HST"];
  if ((NON_PST_REGIONS as readonly string[]).includes(jurisdiction)) return ["GST"];
  if (jurisdiction === "QC") return ["GSTQST"];
  if ((SEPARATE_PST_PROVINCES as readonly string[]).includes(jurisdiction)) {
    return jurisdiction === "MB" ? ["GST", "RST"] : ["GST", "PST"];
  }
  return ["HST"]; // unknown → legacy default
}

/** Corporate annual-return filing types (only for Corporation-like entities). */
export function annualReturnFilingTypes(config: ComplianceConfig): string[] {
  if (config.entityType && config.entityType !== "Corporation") return [];
  const jur = config.incorporationJurisdiction;
  if (jur === "Federal") return config.incorporationDate ? ["FederalAnnualReturn"] : [];
  if (jur && (PROVINCE_CODES as readonly string[]).includes(jur)) return ["ProvincialAnnualReturn"];
  return [];
}

/** Info-return filing types by entity (+ payroll gate for non-corporate). */
export function infoReturnFilingTypes(config: ComplianceConfig): string[] {
  if (config.entityType === "Trust") return ["T3Slips"];
  // Corporation (or legacy null/unknown) → always T4/T4A/T5.
  if (config.entityType === "Corporation" || !config.entityType) return ["T4", "T4A", "T5"];
  if (config.payrollApplicable) {
    if (config.entityType === "Partnership") return ["T4", "T4A", "T5"];
    // Self-Employed / Individual
    return ["T4", "T4A"];
  }
  return [];
}

/**
 * The full set of filing types the generator would emit for a client
 * configuration. Used to detect obligations that become invalid when the
 * entity type or jurisdiction changes.
 */
export function filingTypesForClient(config: ComplianceConfig): Set<string> {
  const set = new Set<string>();
  set.add(incomeTaxFilingType(config.entityType));

  if (config.hstApplicable && config.hstFrequency) {
    for (const t of salesTaxFilingTypes(config.incorporationJurisdiction)) set.add(t);
  }

  for (const t of annualReturnFilingTypes(config)) set.add(t);

  if (config.payrollApplicable) {
    if (config.remitterType) set.add("PayrollRemittance");
    if (config.payrollFrequency) set.add("PayrollProcessing");
  }

  for (const t of infoReturnFilingTypes(config)) set.add(t);
  return set;
}

/**
 * Display label for a filing type, optionally including the province for
 * provincial annual returns (e.g. "Provincial Annual Return — Nova Scotia").
 */
export function filingTypeLabel(filingType: string, jurisdiction?: string | null): string {
  const base = FILING_TYPE_LABELS[filingType] ?? filingType;
  if (filingType === "ProvincialAnnualReturn" && jurisdiction) {
    return `${base} — ${jurisdictionLabel(jurisdiction)}`;
  }
  return base;
}

/** Display labels for every filing type. */
export const FILING_TYPE_LABELS: Record<string, string> = {
  T2: "Corporate Tax Return (T2)",
  T1: "Personal Tax Return (T1)",
  T5013: "Partnership Return (T5013)",
  T3: "Trust Return (T3)",
  HST: "GST/HST",
  GST: "GST Return",
  GSTQST: "GST/QST Return",
  PST: "PST Return",
  RST: "RST Return",
  FederalAnnualReturn: "Federal Annual Return",
  ProvincialAnnualReturn: "Provincial Annual Return",
  PayrollRemittance: "Payroll Remittance",
  PayrollProcessing: "Payroll Processing",
  T4: "T4",
  T4A: "T4A",
  T5: "T5",
  T3Slips: "T3 Slips & Summary",
};
