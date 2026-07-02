import Link from "next/link";
import { format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { listObligationsForTenant } from "@/lib/services/obligations";
import { isOverdue } from "@/lib/overdue";

type MonitoringRow = {
  id: string;
  filingType: string;
  filingDueDate: Date | null;
  status: string;
  client: { id: string; fileNumber: string; legalName: string };
};

export default async function MonitoringPage() {
  const user = await requireUser();
  const now = new Date();
  const inAWeek = new Date(now.getTime() + 7 * 24 * 3600 * 1000);

  const [overdue, dueThisWeek, waiting] = await Promise.all([
    listObligationsForTenant(user.tenantId),
    listObligationsForTenant(user.tenantId, { from: now, to: inAWeek }),
    listObligationsForTenant(user.tenantId, { status: "WaitingOnClient" }),
  ]);

  const overdueList = overdue.obligations.filter((o) => isOverdue(o, Date.now()));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Monitoring</h1>
        <p className="text-sm text-fg-muted">Bottlenecks, upcoming deadlines, and items waiting on clients.</p>
      </div>

      <OverdueSection rows={overdueList} />
      <DueThisWeekSection rows={dueThisWeek.obligations} />
      <WaitingSection rows={waiting.obligations} />
    </div>
  );
}

function OverdueSection({ rows }: { rows: MonitoringRow[] }) {
  return (
    <Section
      title="Overdue"
      rows={rows}
      emptyMessage="Nothing overdue. Good."
      borderClass="border-danger/30"
    />
  );
}

function DueThisWeekSection({ rows }: { rows: MonitoringRow[] }) {
  return (
    <Section
      title="Due this week"
      rows={rows}
      emptyMessage="No deadlines in the next 7 days."
      borderClass="border-border"
    />
  );
}

function WaitingSection({ rows }: { rows: MonitoringRow[] }) {
  return (
    <Section
      title="Waiting on client"
      rows={rows}
      emptyMessage="Nothing waiting on a client."
      borderClass="border-warning/30"
    />
  );
}

function Section(props: {
  title: string;
  rows: MonitoringRow[];
  emptyMessage: string;
  borderClass: string;
}) {
  const { title, rows, emptyMessage, borderClass } = props;
  return (
    <section className={"rounded-lg border " + borderClass + " bg-surface p-4"}>
      <h2 className="text-sm font-semibold text-fg">{title}</h2>
      {rows.length === 0 ? (
        <p className="mt-2 text-sm text-fg-muted">{emptyMessage}</p>
      ) : (
        <ul className="mt-3 divide-y divide-border">
          {rows.map((o) => (
            <li key={o.id} className="flex items-center justify-between gap-3 py-2 text-sm">
              <div>
                <Link href={"/clients/" + o.client.id} className="font-medium text-fg hover:underline">
                  {o.client.fileNumber} — {o.client.legalName}
                </Link>
                <span className="ml-3 text-fg-muted">{o.filingType}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-fg-muted">
                  {o.filingDueDate ? format(o.filingDueDate, "MMM d, yyyy") : "—"}
                </span>
                <span className="rounded-full bg-bg-subtle px-2 py-0.5 text-xs text-fg-muted">{o.status}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
