import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getClient } from "@/lib/services/clients";
import { ensureReviewRows, lastNCompletedFiscalYears } from "@/lib/services/reviews";
import { HistoricalReviewMatrix } from "@/components/historical-review-matrix";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.tenantId, id);
  if (!client) notFound();

  await ensureReviewRows(client.id, client.fiscalYearEnd);
  const refreshed = await getClient(user.tenantId, id);
  if (!refreshed) notFound();

  const years = lastNCompletedFiscalYears(refreshed.fiscalYearEnd, 3);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-fg">Historical review</h1>
          <p className="text-sm text-fg-muted">
            <Link href={`/clients/${refreshed.id}`} className="hover:underline">{refreshed.legalName}</Link>{" "}
            · FYE {refreshed.fiscalYearEnd.toISOString().slice(0, 10)}
          </p>
        </div>
        <Link
          href={`/clients/${refreshed.id}`}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-bg-subtle px-3 py-2 text-sm font-medium text-fg shadow-sm hover:bg-surface"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to client
        </Link>
      </div>
      <HistoricalReviewMatrix
        clientId={refreshed.id}
        years={years}
        reviews={refreshed.historicalReviews.map((r) => ({
          id: r.id,
          fiscalYear: r.fiscalYear,
          filingType: r.filingType,
          status: r.status,
          notes: r.notes,
        }))}
        reviewComplete={refreshed.reviewComplete}
      />
    </div>
  );
}
