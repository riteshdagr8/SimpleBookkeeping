import { notFound } from "next/navigation";
import Link from "next/link";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getConfigByType, WORKFLOW_CONFIGS } from "@/lib/workflows/configs";
import { listWorkflows, getOrCreateWorkflow } from "@/lib/workflows/service";
import { getActiveInteraction } from "@/lib/workflows/interactions";
import { WorkflowFilters } from "@/components/workflow-filters";
import { WorkflowEditor } from "@/components/workflow-editor";
import type { WorkflowType } from "@/lib/workflows/types";

const FILING_TYPE_LABELS: Record<string, string> = {
  HST: "GST/HST",
};

function filingTypeLabel(t: string): string {
  return FILING_TYPE_LABELS[t] ?? t;
}

/**
 * Build the props for the list page of a given workflow type. Used by each
 * workflow's page.tsx. Returns the list rows + active client list for the
 * filter dropdown.
 */
export async function buildWorkflowListProps(
  type: WorkflowType,
  searchParams: { clientId?: string; from?: string; to?: string; status?: string }
) {
  const user = await requireUser();
  const config = getConfigByType(type);
  if (!config) notFound();

  const filters = {
    clientId: searchParams.clientId,
    from: searchParams.from ? new Date(searchParams.from) : undefined,
    to: searchParams.to ? new Date(searchParams.to) : undefined,
    status: searchParams.status,
  };
  const rows = await listWorkflows(user.tenantId, type, filters);

  // Active clients for the filter dropdown.
  const clients = await prisma.client.findMany({
    where: { tenantId: user.tenantId, active: true },
    orderBy: [{ fileNumber: "asc" }],
    select: { id: true, fileNumber: true, legalName: true },
  });

  // Build the status list for the filter (initial + all statusByStep entries).
  const allStatuses = Array.from(new Set([config.initialStatus, ...config.statusByStep]));

  return { user, config, rows, clients, allStatuses };
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
  clients,
  allStatuses,
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
        <WorkflowFilters clients={clients} statuses={allStatuses} slug={config.slug} />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Filing due</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Updated</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-6 text-center text-fg-muted">
                  No items match the current filters.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.obligationId} className="border-t border-border">
                <td className="px-3 py-2 font-medium text-fg">
                  <Link
                    href={`/${config.slug}/${r.obligationId}`}
                    className="text-fg hover:text-primary hover:underline"
                  >
                    {r.client.fileNumber} — {r.client.legalName}
                  </Link>
                </td>
                <td className="px-3 py-2 text-fg">{filingTypeLabel(r.obligation.filingType)}</td>
                <td className="px-3 py-2 text-fg-muted">{formatUTC(r.obligation.filingDueDate)}</td>
                <td className="px-3 py-2 text-fg">
                  <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs">{r.status}</span>
                </td>
                <td className="px-3 py-2 text-fg-muted">
                  {r.updatedAt.getTime() > 0 ? format(r.updatedAt, "MMM d, yyyy") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

  // For Info Returns, customize the display name and step labels based on the
  // specific filing type (T4, T4A, or T5).
  const displayName = type === "InfoReturn" && config.filingTypes.length > 1
    ? `${config.shortName} — ${obligation.filingType} Filing`
    : config.displayName;

  if (type === "InfoReturn" && config.filingTypes.length > 1) {
    visibleSteps = visibleSteps.map((s) => ({
      ...s,
      label: s.label.replace(/T4\/T4A\/T5/gi, obligation.filingType)
        .replace("Slips prepared", `${obligation.filingType} slips prepared`)
        .replace("Summary prepared", `${obligation.filingType} Summary prepared`),
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
            {client.fileNumber} · FYE {formatUTC(client.fiscalYearEnd, true)} · Due{" "}
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
