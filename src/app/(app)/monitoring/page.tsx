import { requireUser } from "@/lib/auth";
import { listObligationsForTenant } from "@/lib/services/obligations";
import { isOverdue } from "@/lib/overdue";
import { getWorkflowStatuses } from "@/lib/workflows/status-map";
import { MonitoringFilters } from "@/components/monitoring-filters";

type MonitoringRow = {
  id: string;
  filingType: string;
  filingDueDate: Date | null;
  status: string;
  client: { id: string; fileNumber: string | null; legalName: string };
};

export default async function MonitoringPage() {
  const user = await requireUser();
  const now = Date.now();
  const inAWeek = new Date(now + 7 * 24 * 3600 * 1000);

  const { obligations } = await listObligationsForTenant(user.tenantId);

  // The workflow engine persists status only in the per-workflow tables; it never
  // updates FilingObligation.status. Read the real workflow status so Monitoring
  // reflects the workflow pages and the "Waiting on client" section isn't empty.
  const workflowStatuses = await getWorkflowStatuses(obligations);
  function effectiveStatus(o: (typeof obligations)[number]): string {
    const ws = workflowStatuses.get(o.id);
    if (ws) return ws;
    if (o.status === "Filed/Completed") return "Completed";
    return o.status;
  }

  const rows: MonitoringRow[] = obligations.map((o) => ({
    id: o.id,
    filingType: o.filingType,
    filingDueDate: o.filingDueDate,
    status: effectiveStatus(o),
    client: o.client,
  }));

  const overdueList = rows.filter((r) => isOverdue(r, now));
  const dueThisWeek = rows.filter((r) => {
    if (!r.filingDueDate) return false;
    const t = r.filingDueDate.getTime();
    return t >= now && t <= inAWeek.getTime();
  });
  const waiting = rows.filter((r) => r.status === "WaitingOnClient");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Monitoring</h1>
        <p className="text-sm text-fg-muted">Bottlenecks, upcoming deadlines, and items waiting on clients.</p>
      </div>

      <MonitoringFilters overdue={overdueList} dueThisWeek={dueThisWeek} waiting={waiting} />
    </div>
  );
}
