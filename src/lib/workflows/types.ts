// Workflow types shared by the configs, status derivation, and service.

export type WorkflowType =
  | "Payroll"
  | "SalesTax"
  | "IncomeTax"
  | "ProvincialAR"
  | "FederalAR"
  | "InfoReturn";

export interface WorkflowStep {
  /** Stable key, persisted in the JSON `checklist`. */
  key: string;
  /** Display label. */
  label: string;
  /** Comment shown below the checkbox. */
  comment: string;
  /** Optional predicate — if present and returns false, the step is hidden
   *  AND not counted toward the status. Used for conditional steps like
   *  Payroll's "remittances submitted" which only apply to QBO clients. */
  condition?: (ctx: WorkflowContext) => boolean;
  /** Optional predicate that must also return true for the step to count as
   *  achieved. Receives the current field values. Used for steps that require
   *  certain fields to be filled before progressing to the terminal status. */
  fieldsSatisfied?: (fields: Record<string, unknown>) => boolean;
}

export type WorkflowFieldType = "date" | "number" | "text";

export interface WorkflowField {
  /** Database column name on the workflow model. */
  key: string;
  label: string;
  type: WorkflowFieldType;
  /** Optional hint shown below the field. */
  hint?: string;
}

export interface WorkflowConfig {
  /** URL slug, e.g. "payroll", "gst-hst". */
  slug: string;
  /** Display name for page titles. */
  displayName: string;
  /** Short label for nav and breadcrumb chips. */
  shortName: string;
  /** FilingObligation.filingType values handled by this workflow. */
  filingTypes: string[];
  /** Schema name (Prisma model) for the workflow table. */
  prismaModel:
    | "payrollProcessing"
    | "gstHstProcessing"
    | "t2Processing"
    | "ontarioARProcessing"
    | "federalARProcessing"
    | "infoReturnProcessing";
  /** Ordered list of checklist steps. */
  steps: WorkflowStep[];
  /** Per-step status names, same order as `steps`. The last entry is the
   *  terminal "Completed" status. The status for a given checklist is the
   *  status of the last step whose checkbox is checked. */
  statusByStep: string[];
  /** Initial status (no steps checked). */
  initialStatus: string;
  /** Field inputs to render in the editor. */
  fields: WorkflowField[];
  /** Whether to expose the "Waiting on client" interaction flow. */
  allowsClientInteraction: boolean;
  /** WorkflowType for ClientInteraction.targetType. */
  interactionType: WorkflowType;
}

export interface WorkflowContext {
  client: { qbOnlinePayroll?: boolean } & Record<string, unknown>;
  fields?: Record<string, unknown>;
}

export interface ChecklistState {
  [stepKey: string]: boolean;
}

export interface WorkflowUpdateInput {
  checklist: ChecklistState;
  fields: Record<string, string | number | null | undefined>;
}
