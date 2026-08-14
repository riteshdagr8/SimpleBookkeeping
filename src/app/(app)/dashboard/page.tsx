import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listObligationsForTenant } from "@/lib/services/obligations";
import { DashboardFilters } from "@/components/dashboard-filters";
import { workflowLinkForObligation } from "@/lib/workflows/route-map";

interface SP {
  from?: string;
  to?: string;
  status?: string;
  filingType?: string;
  sortBy?: string;
  sortDir?: string;
}

/** Filing type → Prisma model name for workflow status lookup */
const FILING_TYPE_TO_MODEL: Record<string, string> = {
  PayrollRemittance: "payrollProcessing",
  HST: "gSTHSTProcessing",
  T2: "t2Processing",
  OntarioAnnualReturn: "ontarioARProcessing",
  FederalAnnualReturn: "federalARProcessing",
  T4: "infoReturnProcessing",
  T4A: "infoReturnProcessing",
  T5: "infoReturnProcessing",
};

async function getWorkflowStatuses(
  obligations: { id: string; filingType: string }[]
): Promise<Map<string, string>> {
  const byModel = new Map<string, string[]>();
  for (const o of obligations) {
    const model = FILING_TYPE_TO_MODEL[o.filingType];
    if (!model) continue;
    const ids = byModel.get(model) ?? [];
    ids.push(o.id);
    byModel.set(model, ids);
  }

  const statusMap = new Map<string, string>();
  for (const [modelName, ids] of byModel) {
    const delegate = (prisma as unknown as Record<string, {
      findMany: (args: { where: { obligationId: { in: string[] }; }; select: { obligationId: true; status: true }; }) => Promise<{ obligationId: string; status: string }[]>
    }>)[modelName];
    if (!delegate) continue;
    const rows = await delegate.findMany({
      where: { obligationId: { in: ids } },
      select: { obligationId: true, status: true },
    });
    for (const r of rows) {
      statusMap.set(r.obligationId, r.status);
    }
  }
  return statusMap;
}

const TYPE_LABELS: Record<string, string> = {
  T2: "Corporate Tax Return",
  HST: "GST/HST",
  PayrollRemittance: "Payroll Remittance",
  OntarioAnnualReturn: "Ontario Annual Return",
  FederalAnnualReturn: "Federal Annual Return",
};

function typeLabel(t: string): string {
  return TYPE_LABELS[t] ?? t;
}

function isOverdue(due: Date | null, status: string) {
  if (status === "Filed/Completed" || status === "Completed") return false;
  if (!due) return false;
  return due.getTime() < Date.now();
}

function formatUTC(d: Date | null, withYear: boolean): string {
  if (!d) return "—";
  const opts: Intl.DateTimeFormatOptions = {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  };
  return new Intl.DateTimeFormat("en-US", opts).format(d);
}

function statusLabel(s: string): string {
  if (s === "WaitingOnClient") return "Waiting on Client";
  if (s === "InProgress") return "In Progress";
  return s;
}

/** Sort obligations by the given sort key and direction. */
function sortObligations<T extends { client: { fileNumber: string | null; legalName: string }; filingType: string; periodStart: Date | null; periodEnd: Date | null; filingDueDate: Date | null }>(
  items: T[],
  sortBy: string,
  sortDir: string
): T[] {
  const dir = sortDir === "desc" ? -1 : 1;
  return [...items].sort((a, b) => {
    let cmp = 0;
    if (sortBy === "client") {
      cmp = (a.client.fileNumber ?? "").localeCompare(b.client.fileNumber ?? "");
    } else if (sortBy === "type") {
      cmp = typeLabel(a.filingType).localeCompare(typeLabel(b.filingType));
    } else if (sortBy === "period") {
      const ap = a.periodStart?.getTime() ?? 0;
      const bp = b.periodStart?.getTime() ?? 0;
      cmp = ap - bp;
    } else if (sortBy === "filingDue") {
      const ad = a.filingDueDate?.getTime() ?? 0;
      const bd = b.filingDueDate?.getTime() ?? 0;
      cmp = ad - bd;
    }
    return cmp * dir;
  });
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const result = await listObligationsForTenant(user.tenantId, {
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    filingType: sp.filingType || undefined,
  });
  const { clients, obligations } = result;

  // Fetch workflow processing statuses so the dashboard shows the same status
  // as the workflow detail pages.
  const workflowStatuses = await getWorkflowStatuses(obligations);
  function effectiveStatus(o: typeof obligations[number]): string {
    const ws = workflowStatuses.get(o.id);
    if (ws) return ws;
    if (o.status === "Filed/Completed") return "Completed";
    return o.status;
  }

  /** Classify effective status into simplified categories for filtering. */
  function classifyStatus(s: string): string {
    if (s === "Pending" || s === "WaitingOnClient") return s;
    if (s === "Completed" || s === "Filed/Completed") return "Completed";
    return "InProgress";
  }

  // Apply the simplified status filter after computing effective status.
  let filtered = obligations;
  if (sp.status) {
    filtered = filtered.filter((o) => {
      const cat = classifyStatus(effectiveStatus(o));
      return cat === sp.status;
    });
  }

  // Sorting
  const sortBy = sp.sortBy || "filingDue";
  const sortDir = sp.sortDir || "asc";
  filtered = sortObligations(filtered, sortBy, sortDir);

  function toggleSort(field: string): string {
    if (sortBy === field) {
      return sortDir === "asc" ? "desc" : "asc";
    }
    return "asc";
  }

  function sortLink(field: string): string {
    const p = new URLSearchParams();
    if (sp.from) p.set("from", sp.from);
    if (sp.to) p.set("to", sp.to);
    if (sp.status) p.set("status", sp.status);
    if (sp.filingType) p.set("filingType", sp.filingType);
    p.set("sortBy", field);
    p.set("sortDir", toggleSort(field));
    return `?${p.toString()}`;
  }

  const overdueCount = filtered.filter((o) => isOverdue(o.filingDueDate, effectiveStatus(o))).length;
  const waitingCount = filtered.filter((o) => classifyStatus(effectiveStatus(o)) === "WaitingOnClient").length;
  const inProgressCount = filtered.filter((o) => classifyStatus(effectiveStatus(o)) === "InProgress").length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Dashboard</h1>
          <p className="text-sm text-fg-muted">All compliance obligations across the tenant.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
        <Stat label="Clients" value={clients.length} />
        <Stat label="Total obligations" value={filtered.length} />
        <Stat label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "danger" : "default"} />
        <Stat label="Waiting on client" value={waitingCount} tone={waitingCount > 0 ? "warning" : "default"} />
      </div>

      <div className="rounded-lg border border-border bg-surface p-4">
        <DashboardFilters />
      </div>

      <div className="overflow-hidden rounded-lg border border-border bg-surface">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-subtle text-left text-xs text-fg-muted">
            <tr>
              <th className="px-3 py-2 font-medium">
                <Link href={sortLink("client")} className="hover:text-fg">
                  Client {sortBy === "client" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </Link>
              </th>
              <th className="px-3 py-2 font-medium">
                <Link href={sortLink("type")} className="hover:text-fg">
                  Type {sortBy === "type" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </Link>
              </th>
              <th className="px-3 py-2 font-medium">
                <Link href={sortLink("period")} className="hover:text-fg">
                  Period {sortBy === "period" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </Link>
              </th>
              <th className="px-3 py-2 font-medium">
                <Link href={sortLink("filingDue")} className="hover:text-fg">
                  Filing due {sortBy === "filingDue" ? (sortDir === "asc" ? "▲" : "▼") : ""}
                </Link>
              </th>
              <th className="px-3 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-8 text-center text-fg-muted">
                  No obligations match the current filters.
                </td>
              </tr>
            )}
            {filtered.map((o) => {
              const stat = effectiveStatus(o);
              const overdue = isOverdue(o.filingDueDate, stat);
              return (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/clients/${o.client.id}`} className="font-medium text-fg hover:underline">
                      {o.client.fileNumber ? `${o.client.fileNumber} — ` : ""}
                      {o.client.legalName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-fg">
                    {(() => {
                      const href = workflowLinkForObligation(o.filingType, o.id);
                      if (!href) return typeLabel(o.filingType);
                      const restoreQs = new URLSearchParams();
                      if (sp.from) restoreQs.set("from", sp.from);
                      if (sp.to) restoreQs.set("to", sp.to);
                      if (sp.status) restoreQs.set("status", sp.status);
                      if (sp.filingType) restoreQs.set("filingType", sp.filingType);
                      const params = new URLSearchParams({ _ref: "dashboard" });
                      if (restoreQs.toString()) params.set("_dash", restoreQs.toString());
                      return (
                        <Link href={`${href}?${params.toString()}`} className="text-primary hover:underline">
                          {typeLabel(o.filingType)}
                        </Link>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-fg-muted">
                    {o.periodStart && o.periodEnd
                      ? `${formatUTC(o.periodStart, true)} – ${formatUTC(o.periodEnd, true)}`
                      : "—"}
                  </td>
                  <td className={`px-3 py-2 ${overdue ? "font-medium text-danger" : "text-fg-muted"}`}>
                    {o.filingDueDate ? formatUTC(o.filingDueDate, true) : "—"}
                  </td>
                  <td className="px-3 py-2 text-fg">{statusLabel(stat)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "warning" | "danger" }) {
  const color = tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-fg";
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
