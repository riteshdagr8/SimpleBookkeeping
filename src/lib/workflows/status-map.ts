import { prisma } from "@/lib/prisma";

/** Filing type → Prisma model name for workflow status lookup. */
export const FILING_TYPE_TO_MODEL: Record<string, string> = {
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

/**
 * Map obligation IDs to their workflow processing status, read from the
 * per-workflow tables. The workflow engine never writes FilingObligation.status,
 * so any status-aware view (dashboard, monitoring) must consult these tables.
 */
export async function getWorkflowStatuses(
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
  await Promise.all(
    Array.from(byModel.entries()).map(async ([modelName, ids]) => {
      const delegate = (prisma as unknown as Record<
        string,
        {
          findMany: (args: { where: { obligationId: { in: string[] } }; select: { obligationId: boolean; status: boolean } }) => Promise<{ obligationId: string; status: string }[]>;
        }
      >)[modelName];
      if (!delegate) return;
      const rows = await delegate.findMany({
        where: { obligationId: { in: ids } },
        select: { obligationId: true, status: true },
      });
      for (const r of rows) statusMap.set(r.obligationId, r.status);
    })
  );
  return statusMap;
}
