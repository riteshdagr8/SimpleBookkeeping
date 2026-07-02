import Link from "next/link";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { listObligationsForTenant } from "@/lib/services/obligations";
import { DashboardFilters } from "@/components/dashboard-filters";

interface SP {
  from?: string;
  to?: string;
  status?: string;
  filingType?: string;
}

function isOverdue(due: Date | null, status: string) {
  if (status === "Filed") return false;
  if (!due) return false;
  return due.getTime() < Date.now();
}

export default async function DashboardPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const result = await listObligationsForTenant(user.tenantId, {
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    status: sp.status || undefined,
    filingType: sp.filingType || undefined,
  });
  const { clients, obligations } = result;

  const overdueCount = obligations.filter((o) => isOverdue(o.filingDueDate, o.status)).length;
  const waitingCount = obligations.filter((o) => o.status === "WaitingOnClient").length;
  const inProgressCount = obligations.filter((o) => o.status === "InProgress" || o.status === "ReadyForReview").length;

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
        <Stat label="Total obligations" value={obligations.length} />
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
              <th className="px-3 py-2 font-medium">Client</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Period</th>
              <th className="px-3 py-2 font-medium">Filing due</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Confirmation</th>
            </tr>
          </thead>
          <tbody>
            {obligations.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-fg-muted">
                  No obligations match the current filters.
                </td>
              </tr>
            )}
            {obligations.map((o) => {
              const overdue = isOverdue(o.filingDueDate, o.status);
              return (
                <tr key={o.id} className="border-t border-border">
                  <td className="px-3 py-2">
                    <Link href={`/clients/${o.client.id}`} className="font-medium text-fg hover:underline">
                      {o.client.fileNumber} — {o.client.legalName}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-fg">{o.filingType}</td>
                  <td className="px-3 py-2 text-fg-muted">
                    {o.periodStart && o.periodEnd
                      ? `${format(o.periodStart, "MMM d")} – ${format(o.periodEnd, "MMM d, yyyy")}`
                      : "—"}
                  </td>
                  <td className={`px-3 py-2 ${overdue ? "font-medium text-danger" : "text-fg-muted"}`}>
                    {o.filingDueDate ? format(o.filingDueDate, "MMM d, yyyy") : "—"}
                  </td>
                  <td className="px-3 py-2 text-fg">{o.status}</td>
                  <td className="px-3 py-2 text-fg-muted">{o.confirmationNumber ?? "—"}</td>
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
