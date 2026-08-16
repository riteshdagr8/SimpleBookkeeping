import type { WorkflowConfig } from "./types";

// 6 workflow configurations. Each one drives a dedicated page, an editor, and
// an API. The `statusByStep` array MUST be the same length as `steps` and in
// the same order: statusByStep[i] is the status a row reaches when step i is
// checked (and all prior steps are also checked). The last entry is always
// the terminal "Completed".

export const WORKFLOW_CONFIGS: Record<string, WorkflowConfig> = {
  Payroll: {
    slug: "payroll",
    displayName: "Payroll Processing",
    shortName: "Payroll",
    filingTypes: ["PayrollRemittance", "PayrollProcessing"],
    prismaModel: "payrollProcessing",
    allowsClientInteraction: true,
    interactionType: "Payroll",
    initialStatus: "Pending",
    // 5 steps → 5 statuses. The 5th (Remittance, conditional) is the terminal
    // for QBO clients. For non-QBO clients, step 4 (Sent) reaches "Completed"
    // when checked with valid employee count and remittance (including 0).
    statusByStep: ["Ready", "Processed", "Generated", "Sent", "Completed"],
    steps: [
      {
        key: "infoCollected",
        label: "Payroll information collected",
        comment: "Collect payroll information.",
      },
      {
        key: "processingCompleted",
        label: "Payroll processing completed",
        comment:
          "Process payroll in QuickBooks Desktop for most clients. For clients with a QuickBooks Online Payroll subscription, process payroll in QuickBooks Online.",
      },
      {
        key: "paystubsGenerated",
        label: "Paystub and payroll report generated",
        comment: "Generate Paystubs and Payroll reports.",
      },
      {
        key: "paystubsSent",
        label: "Paystub and payroll report sent",
        comment:
          "Send payroll reports and pay stubs to the client on the last business day of the month, or on the next business day if the month-end falls on a weekend or holiday",
        fieldsSatisfied: (fields) => {
          // For non-QBO clients, this is the terminal step. Require both fields
          // to be present (including 0 as a valid value).
          const hasEmployeeCount = fields.employeeCount != null && fields.employeeCount !== "";
          const hasTotalRemittance = fields.totalRemittance != null && fields.totalRemittance !== "";
          return hasEmployeeCount && hasTotalRemittance;
        },
      },
      {
        key: "remittancesSubmitted",
        label: "Payroll remittances submitted",
        comment:
          "For clients using QuickBooks Online Payroll, process and submit payroll remittances as required.",
        condition: (ctx) => Boolean(ctx.client.qbOnlinePayroll),
        fieldsSatisfied: (fields) => {
          // For QBO clients, this is the terminal step. Require both fields
          // to be present (including 0 as a valid value).
          const hasEmployeeCount = fields.employeeCount != null && fields.employeeCount !== "";
          const hasTotalRemittance = fields.totalRemittance != null && fields.totalRemittance !== "";
          return hasEmployeeCount && hasTotalRemittance;
        },
      },
    ],
    fields: [
      { key: "employeeCount", label: "Number of employees", type: "number" },
      { key: "totalRemittance", label: "Total remittance", type: "number" },
    ],
  },

  SalesTax: {
    slug: "sales-tax",
    displayName: "Sales Tax",
    shortName: "Sales Tax",
    filingTypes: ["HST", "GSTQST", "GST", "PST", "RST"],
    prismaModel: "gstHstProcessing",
    allowsClientInteraction: true,
    interactionType: "SalesTax",
    initialStatus: "Pending",
    // 6 steps → 6 statuses.
    statusByStep: ["Ready", "Reconciled", "Reviewed", "Prepared", "Approved", "Completed"],
    steps: [
      {
        key: "infoCollected",
        label: "Information collected",
        comment:
          "Collect bank statements, sales records, expense receipts, and other supporting documents from the client.",
      },
      {
        key: "bookkeepingCompleted",
        label: "Bookkeeping completed",
        comment: "Complete the bookkeeping and reconcile transactions in the accounting system.",
      },
      {
        key: "reviewCompleted",
        label: "Review completed",
        comment: "Review sales, expenses, and tax balances.",
      },
      {
        key: "returnPrepared",
        label: "Return prepared",
        comment: "Prepare the sales tax return.",
      },
      {
        key: "approved",
        label: "Approved",
        comment: "Obtain client approval if required.",
      },
      {
        key: "filed",
        label: "Filed",
        comment: "File the return through the CRA or provincial portal.",
        fieldsSatisfied: (fields) => fields.filingDate != null && fields.filingDate !== "",
      },
    ],
    fields: [
      { key: "filingDate", label: "Filing date", type: "date" },
      { key: "amount", label: "Amount (negative = owing, positive = refund)", type: "number" },
    ],
  },

  IncomeTax: {
    slug: "income-taxes",
    displayName: "Income Taxes",
    shortName: "Income Tax",
    filingTypes: ["T2", "T1", "T5013", "T3"],
    prismaModel: "t2Processing",
    allowsClientInteraction: true,
    interactionType: "IncomeTax",
    initialStatus: "Pending",
    // 5 steps → 5 statuses.
    statusByStep: ["Ready", "Prepared", "Reviewed", "Filed", "Completed"],
    steps: [
      {
        key: "infoCollected",
        label: "Information collected",
        comment: "Collect the client's financial information and supporting documents.",
      },
      {
        key: "returnPrepared",
        label: "Return prepared",
        comment: "Prepare the income tax return.",
      },
      {
        key: "reviewedWithClient",
        label: "Reviewed with client",
        comment: "Review with the client if required.",
      },
      {
        key: "filed",
        label: "Filed",
        comment: "File the return with the CRA or applicable agency.",
      },
      {
        key: "approvalReceived",
        label: "Client approval received",
        comment: "If client approval is required, obtain sign-off.",
        fieldsSatisfied: (fields) => fields.filingDate != null && fields.filingDate !== "",
      },
    ],
    fields: [
      { key: "filingDate", label: "Filing date", type: "date" },
      { key: "taxBalance", label: "Tax balance (negative = owing, positive = refund)", type: "number" },
    ],
  },

  ProvincialAR: {
    slug: "provincial-ar",
    displayName: "Provincial Annual Return",
    shortName: "Provincial AR",
    filingTypes: ["ProvincialAnnualReturn"],
    prismaModel: "ontarioARProcessing",
    allowsClientInteraction: true,
    interactionType: "ProvincialAR",
    initialStatus: "Pending",
    // 2 steps → 2 statuses.
    statusByStep: ["Prepared", "Completed"],
    steps: [
      {
        key: "returnPrepared",
        label: "Return prepared",
        comment: "Prepare the provincial annual return.",
      },
      {
        key: "filed",
        label: "Filed with the provincial registry",
        comment: "File the provincial annual return with the applicable registry.",
        fieldsSatisfied: (fields) => fields.filingDate != null && fields.filingDate !== "",
      },
    ],
    fields: [
      { key: "filingDate", label: "Filing date", type: "date" },
      { key: "confirmationNumber", label: "Confirmation number", type: "text" },
      { key: "fee", label: "Fee", type: "number" },
    ],
  },

  FederalAR: {
    slug: "federal-ar",
    displayName: "Federal Annual Return",
    shortName: "Federal AR",
    filingTypes: ["FederalAnnualReturn"],
    prismaModel: "federalARProcessing",
    allowsClientInteraction: true,
    interactionType: "FederalAR",
    initialStatus: "Pending",
    // 2 steps → 2 statuses.
    statusByStep: ["Prepared", "Completed"],
    steps: [
      {
        key: "returnPrepared",
        label: "Return prepared",
        comment: "Prepare the federal annual return.",
      },
      {
        key: "filed",
        label: "Filed with Corporations Canada",
        comment: "File the federal annual return.",
        fieldsSatisfied: (fields) => fields.filingDate != null && fields.filingDate !== "",
      },
    ],
    fields: [
      { key: "filingDate", label: "Filing date", type: "date" },
      { key: "confirmationNumber", label: "Confirmation number", type: "text" },
      { key: "companyKeyStatus", label: "Company key status", type: "text" },
    ],
  },

  InfoReturn: {
    slug: "info-returns",
    displayName: "Information Returns",
    shortName: "Info Returns",
    filingTypes: ["T4", "T4A", "T5", "T3Slips"],
    prismaModel: "infoReturnProcessing",
    allowsClientInteraction: true,
    interactionType: "InfoReturn",
    initialStatus: "Pending",
    // 4 steps → 4 statuses.
    statusByStep: ["Ready", "Prepared", "Filed", "Completed"],
    steps: [
      {
        key: "slipsPrepared",
        label: "Slips prepared",
        comment: "Prepare employee/contractor T4/T4A/T5 slips.",
      },
      {
        key: "summaryPrepared",
        label: "Summary prepared",
        comment: "Prepare T4 Summary (or T4A/T5 equivalent).",
      },
      {
        key: "filed",
        label: "Filed with CRA",
        comment: "File with CRA.",
      },
      {
        key: "copiesSent",
        label: "Copies sent to recipients",
        comment: "Provide copies to Employers / recipients.",
        fieldsSatisfied: (fields) => fields.filingDate != null && fields.filingDate !== "",
      },
    ],
    fields: [
      { key: "filingDate", label: "Filing date", type: "date" },
      { key: "craConfirmationNumber", label: "CRA confirmation number", type: "text" },
    ],
  },
};

export function getConfigBySlug(slug: string): WorkflowConfig | null {
  for (const c of Object.values(WORKFLOW_CONFIGS)) {
    if (c.slug === slug) return c;
  }
  return null;
}

export function getConfigByType(type: string): WorkflowConfig | null {
  return WORKFLOW_CONFIGS[type] ?? null;
}

export function getConfigByFilingType(filingType: string): WorkflowConfig | null {
  for (const c of Object.values(WORKFLOW_CONFIGS)) {
    if (c.filingTypes.includes(filingType)) return c;
  }
  return null;
}
