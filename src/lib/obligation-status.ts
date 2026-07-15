export const OBLIGATION_STATUS_VALUES = [
  "Pending",
  "WaitingOnClient",
  "InProgress",
  "ReadyForReview",
  "Filed/Completed",
  "Overdue",
] as const;

export type ObligationStatus = (typeof OBLIGATION_STATUS_VALUES)[number];
