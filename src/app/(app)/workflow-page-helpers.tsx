import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfigByType, WORKFLOW_CONFIGS } from "@/lib/workflows/configs";
import { listWorkflows, getOrCreateWorkflow } from "@/lib/workflows/service";
import { getActiveInteraction } from "@/lib/workflows/interactions";
import { WorkflowFilters } from "@/components/workflow-filters";
import { WorkflowEditor } from "@/components/workflow-editor";
import { WorkflowTable } from "@/components/workflow-table";
import type { WorkflowType } from "@/lib/workflows/types";
import { filingTypeLabel } from "@/lib/obligation-matrix";
import { jurisdictionLabel } from "@/lib/jurisdictions";

/**
 * Build the props for the list page of a given workflow type. Used by each
 * workflow's page.tsx. Returns the list rows + active client list for the
 * filter dropdown.
 */
const HST_FREQUENCY_VALUES = ["Monthly", "Quarterly", "Annual", "SelfEmployed"];

export async function buildWorkflowListProps(
  type: WorkflowType,
  searchParams: {
    client?: string;
    province?: string;
    fyeMonth?: string;
    frequency?: string;
    from?: string;
    to?: string;
    status?: string;
  }
) {
  const user = await requireUser();
  const config = getConfigByType(type);
  if (!config) notFound();

  // Status defaults to "Pending" on initial load; "all" (or an empty param)
  // shows everything.
  const statusFilter =
    searchParams.status === "all" || searchParams.status === ""
      ? undefined
      : searchParams.status ?? "Pending";
  const fyeMonthNum = Number(searchParams.fyeMonth);
  const filters = {
    clientName: searchParams.client?.trim() || undefined,
    province: searchParams.province || undefined,
    fyeMonth: Number.isInteger(fyeMonthNum) && fyeMonthNum >= 1 && fyeMonthNum <= 12 ? fyeMonthNum : undefined,
    frequency: HST_FREQUENCY_VALUES.includes(searchParams.frequency ?? "") ? searchParams.frequency : undefined,
    from: searchParams.from ? new Date(searchParams.from) : undefined,
    to: searchParams.to ? new Date(searchParams.to) : undefined,
    status: statusFilter,
  };
  const rows = await listWorkflows(user.tenantId, type, filters);

  // Active clients, used to build the Province options.
  const clients = await prisma.client.findMany({
    where: { tenantId: user.tenantId, active: true },
    select: { incorporationJurisdiction: true },
  });

  // Build the status list for the filter (initial + all statusByStep entries).
  // WaitingOnClient is set by the "waiting on client" checkbox, not by a step,
  // so it has to be added here or waiting rows can't be filtered for.
  const allStatuses = Array.from(
    new Set([config.initialStatus, ...config.statusByStep, "WaitingOnClient"])
  );

  // Distinct provinces/territories among active clients — used for the Province
  // filter on the Provincial AR page.
  const provinces =
    type === "ProvincialAR"
      ? Array.from(
          new Set(clients.map((c) => c.incorporationJurisdiction).filter((j): j is string => !!j))
        ).sort()
      : [];

  // Income Taxes is the only list that shows the client's fiscal year-end.
  const showFye = type === "IncomeTax";

  return {
    user,
    config,
    rows,
    allStatuses,
    provinces,
    showFye,
    // Filters that only apply to one workflow.
    showFyeMonth: type === "IncomeTax",
    showFrequency: type === "SalesTax",
    // Sales Tax periods are shown by period end; the other workflows show the
    // filing due date.
    dateColumn: type === "SalesTax" ? ("periodEnd" as const) : ("filingDue" as const),
  };
}

function formatUTC(d: Date | null, withYear = true): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  }).format(d);
}

export function WorkflowListView({
  config,
  rows,
  allStatuses,
  provinces,
  showFye,
  showFyeMonth,
  showFrequency,
  dateColumn,
}: Awaited<ReturnType<typeof buildWorkflowListProps>>) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{config.displayName}</h1>
          <p className="text-sm text-fg-muted">
            {rows.length} item{rows.length === 1 ? "" : "s"} matching current filters.
          </p>
        </div>
        <Link
          href={`/${config.slug}`}
          className="text-sm text-fg-muted hover:text-fg"
        >
          Reset filters
        </Link>
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <WorkflowFilters
          statuses={allStatuses}
          slug={config.slug}
          provinces={provinces}
          showFyeMonth={showFyeMonth}
          showFrequency={showFrequency}
        />
      </div>

      <WorkflowTable rows={rows} slug={config.slug} showFye={showFye} dateColumn={dateColumn} />
    </div>
  );
}

/**
 * Build the props for the detail page of a given workflow. Tenant-scoped.
 * Lazy-creates the workflow row on first visit.
 */
export async function buildWorkflowDetailProps(
  type: WorkflowType,
  obligationId: string,
  searchParams?: { from?: string; clientId?: string; _ref?: string; [k: string]: string | undefined }
) {
  const user = await requireUser();
  const config = getConfigByType(type);
  if (!config) notFound();

  // Find the obligation, scoped to the tenant via the client.
  const obligation = await prisma.filingObligation.findFirst({
    where: {
      id: obligationId,
      client: { tenantId: user.tenantId },
    },
    include: {
      client: true,
    },
  });
  if (!obligation) notFound();
  if (!config.filingTypes.includes(obligation.filingType)) notFound();

  // Lazy-create the workflow row.
  const row = await getOrCreateWorkflow(user.tenantId, type, obligationId);

  // Look up the active interaction.
  const interaction = await getActiveInteraction(config.interactionType, obligationId);

  // Project the row's fields into a plain object keyed by field name.
  const fields: Record<string, string | number | null> = {};
  for (const f of config.fields) {
    const v = (row as unknown as Record<string, unknown>)[f.key];
    if (v === null || v === undefined) {
      fields[f.key] = null;
    } else if (v instanceof Date) {
      fields[f.key] = v.toISOString();
    } else {
      fields[f.key] = v as string | number;
    }
  }

  // Parse the checklist.
  let checklist: Record<string, boolean> = {};
  try {
    const parsed = JSON.parse(row.checklist);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      checklist = parsed as Record<string, boolean>;
    }
  } catch {}

  // Filter the steps to those that are visible for this client, AND strip the
  // `condition` predicate (which is a function and can't cross the
  // server-to-client component boundary).
  let visibleSteps = config.steps
    .filter((s) => !s.condition || s.condition({ client: obligation.client }))
    .map((s) => ({ key: s.key, label: s.label, comment: s.comment }));

  // For multi-type configs (Income Taxes, Sales Tax, Info Returns), customize
  // the display name and step labels based on the specific filing type.
  const isMultiType = config.filingTypes.length > 1;
  const displayName = isMultiType
    ? `${config.shortName} — ${filingTypeLabel(obligation.filingType, obligation.client.incorporationJurisdiction)}`
    : obligation.filingType === "ProvincialAnnualReturn" && obligation.client.incorporationJurisdiction
      ? `${config.displayName} — ${jurisdictionLabel(obligation.client.incorporationJurisdiction)}`
      : config.displayName;

  if (isMultiType) {
    visibleSteps = visibleSteps.map((s) => ({
      ...s,
      label: s.label
        .replace(/T4\/T4A\/T5/gi, filingTypeLabel(obligation.filingType))
        .replace(/Slips prepared/gi, `${filingTypeLabel(obligation.filingType)} slips prepared`)
        .replace(/Summary prepared/gi, `${filingTypeLabel(obligation.filingType)} Summary prepared`),
    }));
  }

  return {
    user,
    config,
    displayName,
    visibleSteps,
    obligation: {
      id: obligation.id,
      filingType: obligation.filingType,
      periodStart: obligation.periodStart,
      periodEnd: obligation.periodEnd,
      filingDueDate: obligation.filingDueDate,
      paymentDueDate: obligation.paymentDueDate,
    },
    client: obligation.client,
    workflow: {
      id: row.id,
      status: row.status,
      checklist,
      fields,
    },
    interaction,
    referrer: searchParams?.from === "schedule" && searchParams?.clientId
      ? { from: "schedule" as const, clientId: searchParams.clientId }
      : searchParams?._ref === "dashboard"
        ? { from: "dashboard" as const, clientId: undefined, _dash: searchParams._dash }
        : null,
  };
}

export function WorkflowDetailView({
  config,
  displayName,
  visibleSteps,
  obligation,
  client,
  workflow,
  interaction,
  referrer,
}: Awaited<ReturnType<typeof buildWorkflowDetailProps>>) {
  const backHref = referrer?.from === "schedule"
    ? `/clients/${referrer.clientId}/schedule`
    : referrer?.from === "dashboard"
      ? `/dashboard${referrer._dash ? `?${referrer._dash}` : ""}`
      : `/${config.slug}`;
  const backLabel = referrer?.from === "schedule"
    ? "← Back to schedule"
    : referrer?.from === "dashboard"
      ? "← Back to dashboard"
      : "← Back to list";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">
            <Link href={`/${config.slug}`} className="text-fg-muted hover:text-fg">
              {displayName}
            </Link>
            <span className="px-2 text-fg-muted">/</span>
            <span>{client.legalName}</span>
          </h1>
          <p className="text-sm text-fg-muted">
            {client.fileNumber ? `${client.fileNumber} · ` : ""}FYE{" "}
            {formatUTC(client.fiscalYearEnd, true)} · Due{" "}
            {formatUTC(obligation.filingDueDate, true)}
          </p>
        </div>
        <Link
          href={backHref}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm font-medium text-fg shadow-sm hover:bg-surface"
        >
          {backLabel}
        </Link>
      </div>

      <WorkflowEditor
        config={{
          slug: config.slug,
          displayName: config.displayName,
          shortName: config.shortName,
          allowsClientInteraction: config.allowsClientInteraction,
          fields: config.fields,
        }}
        visibleSteps={visibleSteps}
        obligationId={obligation.id}
        initial={workflow}
        client={client}
        hasActiveInteraction={interaction !== null}
        interactionNote={interaction?.note ?? ""}
      />
    </div>
  );
}

/** Helper: build the per-page search-params type the helpers expect. */
export interface WorkflowPageSearchParams {
  clientId?: string;
  from?: string;
  to?: string;
  status?: string;
}

/** Re-export so each page can `import { WORKFLOW_CONFIGS } from "..."`. */
export { WORKFLOW_CONFIGS };
