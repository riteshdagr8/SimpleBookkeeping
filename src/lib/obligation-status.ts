export const OBLIGATION_STATUS_VALUES = [
  "Pending",
  "WaitingOnClient",
  "InProgress",
  "ReadyForReview",
  "Filed/Completed",
] as const;

export type ObligationStatus = (typeof OBLIGATION_STATUS_VALUES)[number];
