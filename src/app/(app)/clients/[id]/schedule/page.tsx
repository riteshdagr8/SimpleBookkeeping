import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClient } from "@/lib/services/clients";
import { listObligationsForClient } from "@/lib/services/obligations";
import { ScheduleActions } from "./schedule-actions";
import { ObligationTable } from "@/components/obligation-table";
import { getConfigByFilingType } from "@/lib/workflows/configs";

const WORKFLOW_FILING_TYPES = new Set([
  "PayrollRemittance", "HST", "GSTQST", "GST", "PST", "RST",
  "T2", "T1", "T5013", "T3", "ProvincialAnnualReturn",
  "FederalAnnualReturn", "T4", "T4A", "T5", "T3Slips",
]);

/** Filing type → Prisma model name */
const FILING_TYPE_TO_MODEL: Record<string, string> = {
  PayrollRemittance: "payrollProcessing",
  HST: "gSTHSTProcessing",
  GSTQST: "gSTHSTProcessing",
  GST: "gSTHSTProcessing",
  PST: "gSTHSTProcessing",
  RST: "gSTHSTProcessing",
  T2: "t2Processing",
  T1: "t2Processing",
  T5013: "t2Processing",
  T3: "t2Processing",
  ProvincialAnnualReturn: "ontarioARProcessing",
  FederalAnnualReturn: "federalARProcessing",
  T4: "infoReturnProcessing",
  T4A: "infoReturnProcessing",
  T5: "infoReturnProcessing",
  T3Slips: "infoReturnProcessing",
};

async function getWorkflowStatuses(
  tenantId: string,
  obligations: { id: string; filingType: string }[]
): Promise<Map<string, string>> {
  const statusMap = new Map<string, string>();

  // Group obligation IDs by model
  const byModel = new Map<string, string[]>();
  for (const o of obligations) {
    if (!WORKFLOW_FILING_TYPES.has(o.filingType)) continue;
    const model = FILING_TYPE_TO_MODEL[o.filingType];
    if (!model) continue;
    const ids = byModel.get(model) ?? [];
    ids.push(o.id);
    byModel.set(model, ids);
  }

  // Query each model
  const configsByModel = new Map<string, { initialStatus: string }>();
  for (const key of Object.keys(FILING_TYPE_TO_MODEL)) {
    const cfg = getConfigByFilingType(key);
    if (cfg) configsByModel.set(FILING_TYPE_TO_MODEL[key], cfg);
  }

  await Promise.all(
    Array.from(byModel.entries()).map(async ([modelName, obligationIds]) => {
      const rows = await (prisma[modelName as keyof typeof prisma] as unknown as {
        findMany: (args: { where: { obligationId: { in: string[] } }; select: { obligationId: boolean; status: boolean } }) => Promise<{ obligationId: string; status: string }[]>
      }).findMany({
        where: { obligationId: { in: obligationIds } },
        select: { obligationId: true, status: true },
      });
      for (const r of rows) {
        statusMap.set(r.obligationId, r.status);
      }
    })
  );

  return statusMap;
}

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.tenantId, id);
  if (!client) notFound();
  if (!client.active && user.role !== "Admin") notFound();
  const obligations = await listObligationsForClient(user.tenantId, id);
  const workflowStatuses = obligations ? await getWorkflowStatuses(user.tenantId, obligations) : new Map();

  // Within 6 months of the next fiscal year-end? Remind the user to regenerate.
  const today = new Date();
  const nextFye = new Date(client.fiscalYearEnd);
  nextFye.setUTCFullYear(nextFye.getUTCFullYear() + 1);
  const monthsToNextFye = (nextFye.getTime() - today.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
  const showMultiYearReminder = monthsToNextFye <= 6 && monthsToNextFye > 0;

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

      {showMultiYearReminder && (
        <div className="rounded-md border border-accent/30 bg-accent/10 px-3 py-2 text-sm text-fg">
          Schedule covers the current fiscal year. Within 6 months of next year-end — update the FYE on the master data form and click &quot;Generate schedule&quot; again to load the next year.
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
          workflowStatus: workflowStatuses.get(o.id) ?? null,
          amount: o.amount,
          dateFiled: o.dateFiled ? o.dateFiled.toISOString() : null,
          confirmationNumber: o.confirmationNumber,
          notes: o.notes,
        }))}
      />
    </div>
  );
}
