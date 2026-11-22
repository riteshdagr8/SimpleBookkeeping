import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import type {
  ChecklistState,
  WorkflowConfig,
  WorkflowField,
  WorkflowType,
} from "./types";
import { fieldsForFilingType, getConfigByType, WORKFLOW_CONFIGS } from "./configs";
import { frequencyForPeriod } from "@/lib/payroll-frequency";
import { deriveStatus } from "./status";

type AnyWorkflowRow = {
  id: string;
  obligationId: string;
  status: string;
  checklist: string;
  [k: string]: unknown;
};

function parseChecklist(s: string): ChecklistState {
  try {
    const v = JSON.parse(s);
    if (Array.isArray(v)) return {};
    return typeof v === "object" && v !== null ? (v as ChecklistState) : {};
  } catch {
    return {};
  }
}

function serializeChecklist(c: ChecklistState): string {
  return JSON.stringify(c ?? {});
}

/**
 * Compare a field value with its stored value. Dates are compared by time:
 * `===` on two Date objects is always false, which made the no-op guard in
 * updateWorkflow never fire for date fields.
 */
function sameFieldValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  return a === b;
}

/**
 * Map a workflow type to its Prisma model accessor. Each branch returns the
 * same shape so the caller can treat the row uniformly.
 */
export function modelByType(type: WorkflowType): {
  findUnique: (args: { where: { obligationId: string } }) => Promise<unknown>;
  upsert: (args: {
    where: { obligationId: string };
    create: Record<string, unknown>;
    update: Record<string, unknown>;
  }) => Promise<unknown>;
  findFirst: (args: { where: Record<string, unknown> }) => Promise<unknown>;
  findMany: (args: { where: Record<string, unknown> }) => Promise<unknown[]>;
} {
  // Prisma's generated client types each model separately. We access via the
  // dynamic `prisma[modelName]` API and return a small facade.
  const m = prisma[type === "Payroll" ? "payrollProcessing" :
    type === "SalesTax" ? "gSTHSTProcessing" :
    type === "IncomeTax" ? "t2Processing" :
    type === "ProvincialAR" ? "ontarioARProcessing" :
    type === "FederalAR" ? "federalARProcessing" :
    "infoReturnProcessing"] as unknown as {
    findUnique: (args: { where: { obligationId: string } }) => Promise<unknown>;
    upsert: (args: {
      where: { obligationId: string };
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    }) => Promise<unknown>;
    findFirst: (args: { where: Record<string, unknown> }) => Promise<unknown>;
    findMany: (args: { where: Record<string, unknown> }) => Promise<unknown[]>;
  };
  return m;
}

/**
 * Get the workflow row for an obligation, or create a default one if it
 * doesn't exist. Returns the row as a plain object (AnyWorkflowRow).
 */
export async function getOrCreateWorkflow(
  tenantId: string,
  type: WorkflowType,
  obligationId: string
): Promise<AnyWorkflowRow> {
  const model = modelByType(type);
  const existing = (await model.findUnique({ where: { obligationId } })) as AnyWorkflowRow | null;
  if (existing) return existing;
  // Create with defaults. The base columns are common to all 6 tables.
  const config = getConfigByType(type);
  if (!config) throw new Error(`No workflow config for type ${type}`);
  return (await model.upsert({
    where: { obligationId },
    create: {
      obligationId,
      status: config.initialStatus,
      checklist: "{}",
    },
    update: {},
  })) as AnyWorkflowRow;
}

/**
 * Update a workflow row's checklist and fields. Re-derives the status from
 * the new checklist and persists it. Audits the change.
 */
export async function updateWorkflow(
  tenantId: string,
  actorId: string,
  type: WorkflowType,
  obligationId: string,
  input: {
    checklist: ChecklistState;
    fields: Record<string, string | number | null | undefined>;
    waitingOnClient?: boolean;
  }
): Promise<AnyWorkflowRow> {
  const config = getConfigByType(type);
  if (!config) throw new Error(`No workflow config for type ${type}`);

  // The obligation scopes the request to the tenant and tells us which filing
  // type's fields apply.
  const obligation = await prisma.filingObligation.findFirst({
    where: { id: obligationId, client: { tenantId } },
    select: { id: true, clientId: true, filingType: true, amount: true },
  });
  if (!obligation) throw new Error("Obligation not found");

  // Look up the client (for the qbOnlinePayroll predicate).
  const client = await prisma.client.findFirst({
    where: { id: obligation.clientId, tenantId },
    select: { qbOnlinePayroll: true, id: true },
  });
  if (!client) throw new Error("Client not found");

  const applicable = fieldsForFilingType(config, obligation.filingType);
  const workflowFields = applicable.filter((f) => f.storage !== "obligation");
  const obligationFields = applicable.filter((f) => f.storage === "obligation");

  // Fields stored on the workflow row. Coerce values to the Prisma types.
  const fieldData: Record<string, unknown> = {};
  for (const f of workflowFields) {
    const v = input.fields[f.key];
    if (v === undefined || v === null || v === "") {
      if (f.type === "date") fieldData[f.key] = null;
      else if (f.type === "number") fieldData[f.key] = null;
      else fieldData[f.key] = null;
      continue;
    }
    if (f.type === "date") {
      fieldData[f.key] = new Date(String(v));
    } else if (f.type === "number") {
      fieldData[f.key] = Number(v);
    } else {
      fieldData[f.key] = String(v);
    }
  }

  // Fields stored on the obligation. A key absent from the input is left
  // alone, so callers that don't send it (such as the interaction close) can't
  // clear it. A key sent as null clears it.
  const obligationData: Record<string, unknown> = {};
  for (const f of obligationFields) {
    if (!(f.key in input.fields)) continue;
    const v = input.fields[f.key];
    obligationData[f.key] = v === undefined || v === null || v === "" ? null : Number(v);
  }
  const obligationChanged = Object.keys(obligationData).some(
    (k) => obligationData[k] !== (obligation as unknown as Record<string, unknown>)[k]
  );

  const newStatus = deriveStatus(
    input.checklist,
    config,
    { client, fields: { ...fieldData, ...obligationData } },
    input.waitingOnClient
  );
  const checklistJson = serializeChecklist(input.checklist);

  const model = modelByType(type);

  // Check if anything actually changed — skip the upsert if not, so that
  // updatedAt doesn't advance on no-op saves.
  const existing = (await model.findUnique({ where: { obligationId } })) as AnyWorkflowRow | null;
  if (existing) {
    const existingFields = workflowFields.every(
      (f) => sameFieldValue(fieldData[f.key], existing[f.key] ?? null)
    );
    if (
      existing.status === newStatus &&
      existing.checklist === checklistJson &&
      existingFields &&
      !obligationChanged
    ) {
      return existing;
    }
  }

  if (obligationChanged) {
    await prisma.filingObligation.update({ where: { id: obligationId }, data: obligationData });
  }

  const updated = (await model.upsert({
    where: { obligationId },
    create: {
      obligationId,
      status: newStatus,
      checklist: checklistJson,
      ...fieldData,
    },
    update: {
      status: newStatus,
      checklist: checklistJson,
      ...fieldData,
    },
  })) as AnyWorkflowRow;

  await writeAudit({
    tenantId,
    actorId,
    action: `${type.toUpperCase()}_UPDATED`,
    entity: "FilingObligation",
    entityId: obligationId,
    metadata: { status: newStatus },
  });

  return updated;
}

/**
 * List workflow rows for a workflow type, with filters. Joins to the
 * obligation and the client for display.
 */
export interface ListFilters {
  /** Case-insensitive partial match on the client's legal name. */
  clientName?: string;
  province?: string;
  /** Client fiscal year-end month, 1 (Jan) to 12 (Dec). */
  fyeMonth?: number;
  /** Client.hstFrequency: Monthly | Quarterly | Annual | SelfEmployed. */
  frequency?: string;
  /** Pay frequency of a Payroll Processing row: Weekly | Bi-Weekly | Semi-Monthly | Monthly. */
  payFrequency?: string;
  from?: Date;
  to?: Date;
  status?: string;
}

export interface ListedWorkflow {
  id: string;
  obligationId: string;
  status: string;
  checklist: ChecklistState;
  fields: Record<string, string | number | null>;
  obligation: {
    id: string;
    filingType: string;
    filingDueDate: Date | null;
    periodStart: Date | null;
    periodEnd: Date | null;
    amount: number | null;
  };
  client: {
    id: string;
    fileNumber: string | null;
    legalName: string;
    incorporationJurisdiction: string | null;
    fiscalYearEnd: Date;
    incorporationDate: Date | null;
  };
  updatedAt: Date;
}

export async function listWorkflows(
  tenantId: string,
  type: WorkflowType,
  filters: ListFilters
): Promise<ListedWorkflow[]> {
  const config = getConfigByType(type);
  if (!config) return [];

  // Find the obligation IDs that match the filing types for this workflow.
  const obligations = await prisma.filingObligation.findMany({
    where: {
      filingType: { in: config.filingTypes },
      client: {
        tenantId,
        active: true,
        ...(filters.province ? { incorporationJurisdiction: filters.province } : {}),
      },
    },
    select: {
      id: true,
      filingType: true,
      filingDueDate: true,
      periodStart: true,
      periodEnd: true,
      amount: true,
      clientId: true,
      client: { select: { id: true, fileNumber: true, legalName: true, incorporationJurisdiction: true, fiscalYearEnd: true, incorporationDate: true, hstFrequency: true, tenantId: true } },
    },
  });

  // Client-level filters are applied here (the client name needs a
  // case-insensitive match, which is simplest to do on the loaded rows).
  const nameNeedle = filters.clientName?.trim().toLowerCase();
  const filtered = obligations.filter((o) => {
    if (nameNeedle && !o.client.legalName.toLowerCase().includes(nameNeedle)) return false;
    if (filters.fyeMonth && o.client.fiscalYearEnd.getUTCMonth() + 1 !== filters.fyeMonth) return false;
    if (filters.frequency && o.client.hstFrequency !== filters.frequency) return false;
    if (filters.payFrequency) {
      if (!o.periodStart || !o.periodEnd) return false;
      if (frequencyForPeriod(o.periodStart, o.periodEnd) !== filters.payFrequency) return false;
    }
    if (filters.from && o.filingDueDate && o.filingDueDate.getTime() < filters.from.getTime()) return false;
    if (filters.to && o.filingDueDate && o.filingDueDate.getTime() > filters.to.getTime()) return false;
    return true;
  });

  if (filtered.length === 0) return [];

  // Fetch the workflow rows for these obligations.
  const ids = filtered.map((o) => o.id);
  const model = modelByType(type);
  // One query for all rows, instead of one findFirst per obligation.
  const rowsRaw = (await model.findMany({ where: { obligationId: { in: ids } } })) as AnyWorkflowRow[];
  const rowsByObligation = new Map<string, AnyWorkflowRow>();
  for (const r of rowsRaw) rowsByObligation.set(r.obligationId, r);

  const out: ListedWorkflow[] = [];
  for (const o of filtered) {
    const row = rowsByObligation.get(o.id);
    const status = row?.status ?? config.initialStatus;
    if (filters.status && filters.status !== status) continue;
    const fields: Record<string, string | number | null> = {};
    for (const f of config.fields) {
      // Obligation-stored fields (such as amount) come from the obligation.
      const source = f.storage === "obligation"
        ? (o as unknown as Record<string, unknown>)[f.key]
        : row?.[f.key];
      fields[f.key] = (source as string | number | null | undefined) ?? null;
    }
    out.push({
      id: row?.id ?? o.id,
      obligationId: o.id,
      status,
      checklist: row ? parseChecklist(row.checklist) : {},
      fields,
      obligation: {
        id: o.id,
        filingType: o.filingType,
        filingDueDate: o.filingDueDate,
        periodStart: o.periodStart,
        periodEnd: o.periodEnd,
        amount: o.amount,
      },
      client: {
        id: o.client.id,
        fileNumber: o.client.fileNumber,
        legalName: o.client.legalName,
        incorporationJurisdiction: o.client.incorporationJurisdiction,
        incorporationDate: o.client.incorporationDate,
        fiscalYearEnd: o.client.fiscalYearEnd,
      },
      updatedAt: row ? (row.updatedAt as Date) : new Date(0),
    });
  }

  // Sort by filingDueDate asc, then client name.
  out.sort((a, b) => {
    const ad = a.obligation.filingDueDate?.getTime() ?? 0;
    const bd = b.obligation.filingDueDate?.getTime() ?? 0;
    if (ad !== bd) return ad - bd;
    return a.client.legalName.localeCompare(b.client.legalName);
  });

  return out;
}
