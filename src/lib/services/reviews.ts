import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { REVIEW_STATUSES } from "@/lib/review-status";
import {
  REVIEW_GROUPS,
  reviewGroupsForClient,
  type ReviewGroup,
} from "@/lib/review-groups";
import { clientComplianceConfig } from "@/lib/services/obligations";
import { syncReviewYear, type ReviewSyncResult } from "@/lib/services/review-schedule";

export { REVIEW_STATUSES };
export type { ReviewStatus } from "@/lib/review-status";

const reviewStatusEnum = z.enum(REVIEW_STATUSES);

export function lastNCompletedFiscalYears(fye: Date, n: number): number[] {
  // FYE in Dec means fiscal year YYYY ends Dec 31, YYYY. Completed FYs are years whose end has passed.
  const yearOfFye = fye.getUTCFullYear();
  const now = new Date();
  // The most recent completed FY is the FY whose end-date is on/before today.
  let mostRecent = yearOfFye;
  if (fye.getTime() > now.getTime()) mostRecent -= 1;
  const years: number[] = [];
  for (let i = n - 1; i >= 0; i--) years.push(mostRecent - i);
  return years;
}

export async function ensureReviewRows(clientId: string, fye: Date, years: number) {
  const range = lastNCompletedFiscalYears(fye, years);
  for (const fiscalYear of range) {
    for (const filingType of REVIEW_GROUPS) {
      await prisma.historicalReview.upsert({
        where: { clientId_fiscalYear_filingType: { clientId, fiscalYear, filingType } },
        update: {},
        create: { clientId, fiscalYear, filingType, status: "NA" },
      });
    }
  }
}

export async function listReviews(tenantId: string, clientId: string) {
  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } });
  if (!client) return null;
  return prisma.historicalReview.findMany({
    where: { clientId },
    orderBy: [{ fiscalYear: "desc" }, { filingType: "asc" }],
  });
}

export const reviewUpdateSchema = z.object({
  fiscalYear: z.number().int(),
  filingType: z.enum(REVIEW_GROUPS),
  status: reviewStatusEnum,
  notes: z.string().max(500).optional().nullable(),
});

export type ReviewUpdate = z.infer<typeof reviewUpdateSchema>;

/** Statuses that mean the client owes something for that year. */
const NEEDS_OBLIGATIONS: ReadonlyArray<string> = ["Overdue", "OutstandingBalance"];

/**
 * Save one review cell. When the review is marked complete, the client's
 * obligations are then synced for that group and year: Overdue or Outstanding
 * Balance creates the year's filings, Filed or N/A cancels the ones the review
 * created. See syncReviewYear.
 */
export async function upsertReview(
  tenantId: string,
  actorId: string,
  clientId: string,
  input: ReviewUpdate
): Promise<{ review: Awaited<ReturnType<typeof prisma.historicalReview.upsert>>; sync: ReviewSyncResult | null } | null> {
  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } });
  if (!client) return null;
  await ensureReviewRows(clientId, client.fiscalYearEnd, client.reviewYears);
  const review = await prisma.historicalReview.upsert({
    where: {
      clientId_fiscalYear_filingType: {
        clientId,
        fiscalYear: input.fiscalYear,
        filingType: input.filingType,
      },
    },
    update: { status: input.status, notes: input.notes ?? null },
    create: {
      clientId,
      fiscalYear: input.fiscalYear,
      filingType: input.filingType,
      status: input.status,
      notes: input.notes ?? null,
    },
  });
  await writeAudit({
    tenantId,
    actorId,
    action: "REVIEW_UPDATED",
    entity: "Client",
    entityId: clientId,
    metadata: { fiscalYear: input.fiscalYear, filingType: input.filingType, status: input.status },
  });

  let sync: ReviewSyncResult | null = null;
  if (client.reviewComplete) {
    sync = await syncReviewYear(
      tenantId,
      actorId,
      client,
      input.fiscalYear,
      new Set<ReviewGroup>([input.filingType as ReviewGroup]),
      NEEDS_OBLIGATIONS.includes(input.status)
    );
  }
  return { review, sync };
}

/**
 * Sync every group and year of a client's review. Used when the review is
 * marked complete, so all existing Overdue / Outstanding Balance cells take
 * effect at once.
 */
export async function syncClientReview(
  tenantId: string,
  actorId: string,
  clientId: string
): Promise<ReviewSyncResult | null> {
  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } });
  if (!client) return null;
  const applicable = reviewGroupsForClient(clientComplianceConfig(client));
  const rows = await prisma.historicalReview.findMany({ where: { clientId } });
  const totals: ReviewSyncResult = { created: 0, reopened: 0, cancelled: 0 };
  for (const r of rows) {
    if (!(REVIEW_GROUPS as readonly string[]).includes(r.filingType)) continue;
    const group = r.filingType as ReviewGroup;
    if (!applicable.has(group)) continue;
    const res = await syncReviewYear(
      tenantId,
      actorId,
      client,
      r.fiscalYear,
      new Set<ReviewGroup>([group]),
      NEEDS_OBLIGATIONS.includes(r.status)
    );
    totals.created += res.created;
    totals.reopened += res.reopened;
    totals.cancelled += res.cancelled;
  }
  return totals;
}
