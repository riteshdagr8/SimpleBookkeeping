import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import {
  FILING_TYPES,
  REVIEW_STATUSES,
  ensureReviewRows,
  listReviews,
  upsertReview,
} from "@/lib/services/reviews";
import { setReviewComplete } from "@/lib/services/clients";

const putSchema = z.object({
  fiscalYear: z.number().int(),
  filingType: z.enum(FILING_TYPES),
  status: z.enum(REVIEW_STATUSES),
  notes: z.string().max(500).optional().nullable(),
});

const reviewCompleteSchema = z.object({ reviewComplete: z.boolean() });

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await ensureReviewsAndGet(user.tenantId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ client: { id: client.id, reviewComplete: client.reviewComplete }, reviews: client.historicalReviews });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json().catch(() => null);

  // Two payload shapes: a review cell update, OR a reviewComplete toggle.
  const reviewParsed = putSchema.safeParse(body);
  if (reviewParsed.success) {
    const r = await upsertReview(user.tenantId, id, reviewParsed.data);
    if (!r) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ review: r });
  }

  const completeParsed = reviewCompleteSchema.safeParse(body);
  if (completeParsed.success) {
    const ok = await setReviewComplete(user.tenantId, user.id, id, completeParsed.data.reviewComplete);
    if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ reviewComplete: completeParsed.data.reviewComplete });
  }

  return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
}

async function ensureReviewsAndGet(tenantId: string, id: string) {
  const client = await (
    await import("@/lib/prisma")
  ).prisma.client.findFirst({ where: { id, tenantId }, include: { historicalReviews: true } });
  if (!client) return null;
  await ensureReviewRows(client.id, client.fiscalYearEnd);
  return (
    await (await import("@/lib/prisma")).prisma.client.findFirst({
      where: { id, tenantId },
      include: { historicalReviews: { orderBy: [{ fiscalYear: "desc" }, { filingType: "asc" }] } },
    })
  );
}
