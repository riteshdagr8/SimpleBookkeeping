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
    filingTypes: ["PayrollRemittance"],
    prismaModel: "payrollProcessing",
    allowsClientInteraction: true,
    interactionType: "Payroll",
    initialStatus: "Pending",
    // 5 steps → 5 statuses. The 5th (Remittance, conditional) is the terminal
    // for QBO clients. For non-QBO clients, step 4 (Sent) is the terminal
    // because step 5 is hidden.
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
        fieldsSatisfied: (fields) =>
          fields.employeeCount != null && fields.employeeCount !== "" &&
          fields.totalRemittance != null && fields.totalRemittance !== "",
      },
      {
        key: "remittancesSubmitted",
        label: "Payroll remittances submitted",
        comment:
          "For clients using QuickBooks Online Payroll, process and submit payroll remittances as required.",
        condition: (ctx) => Boolean(ctx.client.qbOnlinePayroll),
        fieldsSatisfied: (fields) =>
          fields.employeeCount != null && fields.employeeCount !== "" &&
          fields.totalRemittance != null && fields.totalRemittance !== "",
      },
    ],
    fields: [
      { key: "employeeCount", label: "Number of employees", type: "number" },
      { key: "totalRemittance", label: "Total remittance", type: "number" },
    ],
  },

  GSTHST: {
    slug: "gst-hst",
    displayName: "GST/HST Filing",
    shortName: "GST/HST",
    filingTypes: ["HST"],
    prismaModel: "gstHstProcessing",
    allowsClientInteraction: true,
    interactionType: "GSTHST",
    initialStatus: "Pending",
    // 6 steps → 6 statuses.
    statusByStep: ["Ready", "Reconciled", "Reviewed", "Prepared", "Approved", "Completed"],
    steps: [
      {
        key: "infoCollected",
        label: "Information collected",
        comment:
          "Collect bank statements, credit card statements, sales records, expense receipts, and other supporting documents from the client.",
      },
      {
        key: "bookkeepingCompleted",
        label: "Bookkeeping completed",
        comment: "Complete the bookkeeping and reconcile transactions in the accounting system.",
      },
      {
        key: "reviewCompleted",
        label: "Review completed",
        comment: "Review sales, expenses, and HST balances.",
      },
      {
        key: "returnPrepared",
        label: "Return prepared",
        comment: "Prepare the HST return.",
      },
      {
        key: "approved",
        label: "Approved",
        comment: "Obtain client approval if required.",
      },
      {
        key: "filed",
        label: "Filed",
        comment: "File the HST return through the CRA portal.",
        fieldsSatisfied: (fields) => fields.filingDate != null && fields.filingDate !== "",
      },
    ],
    fields: [
      { key: "filingDate", label: "Filing date", type: "date" },
      { key: "amount", label: "Amount (negative = owing, positive = refund)", type: "number" },
    ],
  },

  T2: {
    slug: "t2",
    displayName: "Corporate Tax Return (T2)",
    shortName: "T2",
    filingTypes: ["T2"],
    prismaModel: "t2Processing",
    allowsClientInteraction: true,
    interactionType: "T2",
    initialStatus: "Pending",
    // 5 steps → 5 statuses.
    statusByStep: ["Ready", "Prepared", "Reviewed", "Filed", "Completed"],
    steps: [
      {
        key: "financialStatementsObtained",
        label: "Year-end financial statements obtained",
        comment: "Obtain year-end financial statements.",
      },
      {
        key: "returnPrepared",
        label: "Corporate tax return prepared",
        comment: "Prepare the corporate tax return using the Profile system.",
      },
      {
        key: "reviewedWithClient",
        label: "Reviewed with client",
        comment: "Review with the client if required.",
      },
      {
        key: "filed",
        label: "Filed with CRA",
        comment: "File the return with the CRA.",
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

  OntarioAR: {
    slug: "ontario-ar",
    displayName: "Ontario Annual Return",
    shortName: "Ontario AR",
    filingTypes: ["OntarioAnnualReturn"],
    prismaModel: "ontarioARProcessing",
    allowsClientInteraction: true,
    interactionType: "OntarioAR",
    initialStatus: "Pending",
    // 2 steps → 2 statuses.
    statusByStep: ["Prepared", "Completed"],
    steps: [
      {
        key: "returnPrepared",
        label: "Return prepared",
        comment: "Prepare the Ontario annual return.",
      },
      {
        key: "filed",
        label: "Filed with Ontario Business Registry",
        comment: "File the Ontario annual return.",
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
    displayName: "Year-end Information Returns (T4/T4A/T5)",
    shortName: "Info Returns",
    filingTypes: ["T4", "T4A", "T5"],
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
