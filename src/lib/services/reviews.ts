import { z } from "zod";
import { prisma } from "@/lib/prisma";

export const FILING_TYPES = ["T2", "HST", "Payroll", "T4", "T4A", "T5"] as const;
export const REVIEW_STATUSES = ["Filed", "Overdue", "OutstandingBalance", "NA"] as const;

export type FilingType = (typeof FILING_TYPES)[number];
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

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

export async function ensureReviewRows(clientId: string, fye: Date) {
  const years = lastNCompletedFiscalYears(fye, 3);
  for (const fiscalYear of years) {
    for (const filingType of FILING_TYPES) {
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
  filingType: z.enum(FILING_TYPES),
  status: reviewStatusEnum,
  notes: z.string().max(500).optional().nullable(),
});

export type ReviewUpdate = z.infer<typeof reviewUpdateSchema>;

export async function upsertReview(tenantId: string, clientId: string, input: ReviewUpdate) {
  const client = await prisma.client.findFirst({ where: { id: clientId, tenantId } });
  if (!client) return null;
  await ensureReviewRows(clientId, client.fiscalYearEnd);
  return prisma.historicalReview.upsert({
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
}
