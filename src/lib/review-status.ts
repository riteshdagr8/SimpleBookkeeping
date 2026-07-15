export const FILING_TYPES = ["T2", "HST", "Payroll", "T4", "T4A", "T5"] as const;
export const REVIEW_STATUSES = ["Filed", "Overdue", "OutstandingBalance", "NA"] as const;

export type FilingType = (typeof FILING_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

/** Display label overrides for filing types — store as the canonical key, display as the label. */
export const FILING_TYPE_LABELS: Record<string, string> = {
  HST: "GST/HST",
};

/** Display label overrides — the stored value is the canonical key. */
export const REVIEW_STATUS_LABELS: Record<ReviewStatus, string> = {
  Filed: "Filed",
  Overdue: "Overdue",
  OutstandingBalance: "Outstanding Balance",
  NA: "N/A",
};
