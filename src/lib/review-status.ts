export const REVIEW_STATUSES = ["Filed", "Overdue", "OutstandingBalance", "NA"] as const;

export type ReviewGroupKey = string;
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
