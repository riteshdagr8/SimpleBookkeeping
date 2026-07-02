import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getClient } from "@/lib/services/clients";
import { listObligationsForClient } from "@/lib/services/obligations";
import { ScheduleActions } from "./schedule-actions";
import { ObligationTable } from "@/components/obligation-table";

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.tenantId, id);
  if (!client) notFound();
  const obligations = await listObligationsForClient(user.tenantId, id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Schedule</h1>
          <p className="text-sm text-fg-muted">
            <Link href={`/clients/${client.id}`} className="hover:underline">{client.legalName}</Link>{" "}
            · FYE {client.fiscalYearEnd.toISOString().slice(0, 10)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/clients/${client.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm font-medium text-fg shadow-sm hover:bg-surface"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to client
          </Link>
          <ScheduleActions clientId={client.id} reviewComplete={client.reviewComplete} />
        </div>
      </div>

      {!client.reviewComplete && (
        <div className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-sm text-warning">
          Historical review must be marked complete before generating the schedule.
        </div>
      )}

      <ObligationTable
        clientId={client.id}
        rows={(obligations ?? []).map((o) => ({
          id: o.id,
          filingType: o.filingType,
          periodStart: o.periodStart ? o.periodStart.toISOString() : null,
          periodEnd: o.periodEnd ? o.periodEnd.toISOString() : null,
          filingDueDate: o.filingDueDate ? o.filingDueDate.toISOString() : null,
          paymentDueDate: o.paymentDueDate ? o.paymentDueDate.toISOString() : null,
          status: o.status,
          amount: o.amount,
          dateFiled: o.dateFiled ? o.dateFiled.toISOString() : null,
          confirmationNumber: o.confirmationNumber,
          notes: o.notes,
        }))}
      />
    </div>
  );
}
