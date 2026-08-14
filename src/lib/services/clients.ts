import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { encrypt, isEncryptedFormat } from "@/lib/services/crypto";
import { writeAudit } from "@/lib/services/audit";

export const DEFAULT_FOLDER_ITEMS = ["CRA Folder", "HST Folder", "Payroll Folder"] as const;

const dateOnly = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v : new Date(v)));

export const clientInputSchema = z.object({
  // File number is optional; empty/null maps to NULL in the DB.
  fileNumber: z.string().trim().max(40).optional().nullable(),
  legalName: z.string().min(1).max(200),
  contactName: z.string().max(200).optional().nullable(),
  incorporationDate: dateOnly
    .optional()
    .nullable()
    .refine(
      (d) => {
        if (d == null) return true;
        // Compare by end-of-day so "today" is still accepted (the date-only input
        // represents midnight UTC; allowing all of today means comparing against
        // the start of tomorrow).
        const tomorrow = new Date();
        tomorrow.setUTCHours(0, 0, 0, 0);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        return d.getTime() < tomorrow.getTime();
      },
      { message: "Incorporation date cannot be in the future" }
    ),
  businessNumber: z
    .string()
    .regex(/^\d{9}$/, "Business number must be 9 digits")
    .max(40)
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  entityType: z.string().max(40).optional().nullable(),
  fiscalYearEnd: dateOnly,
  incorporationJurisdiction: z.enum(["Federal", "Ontario"]).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  primaryEmail: z.string().email().max(200),
  secondaryEmail: z.union([z.string().email().max(200), z.literal("")]).optional().nullable(),
  gstYearEnd: z.string().max(20).optional().nullable(),
  folderPath: z.string().max(1000).optional().nullable(),
  qbPassword: z.string().max(200).optional().nullable(),
  hstApplicable: z.boolean().optional(),
  hstFrequency: z.enum(["Monthly", "Quarterly", "Annual", "SelfEmployed"]).optional().nullable(),
  payrollApplicable: z.boolean().optional(),
  payrollFrequency: z
    .enum(["Weekly", "Bi-Weekly", "Semi-Monthly", "Monthly", "NA"])
    .optional()
    .nullable(),
  remitterType: z
    .enum(["Regular", "Quarterly", "Accelerated1", "Accelerated2"])
    .optional()
    .nullable(),
  qbOnlinePayroll: z.boolean().optional(),
  threeMonthEligible: z.boolean().optional(),
  reviewYears: z.number().int().min(3).max(6).optional(),
  incorporationDocumentsReceived: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
  onboardingStatus: z.enum(["In Progress", "Onboarded", "Waiting on Documents", "Inactive"]).optional(),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

function buildCreateData(input: ClientInput, tenantId: string): Prisma.ClientUncheckedCreateInput {
  return {
    tenantId,
    fileNumber: input.fileNumber?.trim() || null,
    legalName: input.legalName.trim(),
    contactName: input.contactName ?? null,
    businessNumber: input.businessNumber ?? null,
    entityType: input.entityType ?? null,
    fiscalYearEnd: input.fiscalYearEnd,
    incorporationDate: input.incorporationDate ?? null,
    incorporationJurisdiction: input.incorporationJurisdiction ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    primaryEmail: input.primaryEmail,
    secondaryEmail: input.secondaryEmail || null,
    gstYearEnd: input.gstYearEnd || null,
    folderPath: input.folderPath ?? null,
    hstApplicable: input.hstApplicable ?? false,
    hstFrequency: input.hstApplicable ? input.hstFrequency ?? null : null,
    payrollApplicable: input.payrollApplicable ?? false,
    payrollFrequency: input.payrollApplicable ? input.payrollFrequency ?? null : null,
    remitterType: input.payrollApplicable ? input.remitterType ?? null : null,
    qbOnlinePayroll: input.qbOnlinePayroll ?? false,
    onboardingStatus: input.onboardingStatus ?? "In Progress",
    threeMonthEligible: input.threeMonthEligible ?? false,
    reviewYears: input.reviewYears ?? 3,
    incorporationDocumentsReceived: input.incorporationDocumentsReceived ?? false,
    notes: input.notes ?? null,
    qbPasswordEncrypted: resolveQb(input.qbPassword),
  };
}

function buildUpdateData(input: ClientInput): Prisma.ClientUpdateInput {
  return {
    fileNumber: input.fileNumber?.trim() || null,
    legalName: input.legalName.trim(),
    contactName: input.contactName ?? null,
    businessNumber: input.businessNumber ?? null,
    entityType: input.entityType ?? null,
    fiscalYearEnd: input.fiscalYearEnd,
    incorporationDate: input.incorporationDate ?? null,
    incorporationJurisdiction: input.incorporationJurisdiction ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    primaryEmail: input.primaryEmail,
    secondaryEmail: input.secondaryEmail || null,
    gstYearEnd: input.gstYearEnd || null,
    folderPath: input.folderPath ?? null,
    hstApplicable: input.hstApplicable ?? false,
    hstFrequency: input.hstApplicable ? input.hstFrequency ?? null : null,
    payrollApplicable: input.payrollApplicable ?? false,
    payrollFrequency: input.payrollApplicable ? input.payrollFrequency ?? null : null,
    remitterType: input.payrollApplicable ? input.remitterType ?? null : null,
    qbOnlinePayroll: input.qbOnlinePayroll ?? false,
    onboardingStatus: input.onboardingStatus ?? "In Progress",
    threeMonthEligible: input.threeMonthEligible ?? false,
    reviewYears: input.reviewYears ?? undefined,
    incorporationDocumentsReceived: input.incorporationDocumentsReceived ?? undefined,
    notes: input.notes ?? null,
    qbPasswordEncrypted: resolveQb(input.qbPassword),
  };
}

function resolveQb(qb: string | null | undefined): string | null | undefined {
  if (typeof qb === "string" && qb.length > 0) return encrypt(qb);
  if (qb === null) return null;
  return undefined; // signal "do not touch this field"
}

export async function listClients(tenantId: string) {
  return prisma.client.findMany({
    where: { tenantId },
    orderBy: [{ fileNumber: "asc" }],
    select: {
      id: true,
      fileNumber: true,
      legalName: true,
      fiscalYearEnd: true,
      businessNumber: true,
      phone: true,
      primaryEmail: true,
      secondaryEmail: true,
      reviewComplete: true,
      onboardingStatus: true,
      active: true,
    },
  });
}

export async function getClient(tenantId: string, id: string) {
  return prisma.client.findFirst({
    where: { id, tenantId },
    include: {
      folderChecklist: { orderBy: { itemName: "asc" } },
      historicalReviews: { orderBy: [{ fiscalYear: "desc" }, { filingType: "asc" }] },
    },
  });
}

export async function createClient(tenantId: string, actorId: string, input: ClientInput) {
  const data = buildCreateData(input, tenantId);
  let client;
  try {
    client = await prisma.client.create({ data });
  } catch (e) {
    if (e instanceof Error && e.message.includes("Unique constraint") && e.message.includes("fileNumber")) {
      throw new Error(`File number "${input.fileNumber ?? ""}" is already in use.`);
    }
    throw e;
  }
  await prisma.folderChecklistItem.createMany({
    data: DEFAULT_FOLDER_ITEMS.map((itemName) => ({ clientId: client.id, itemName, created: false })),
  });
  await writeAudit({
    tenantId,
    actorId,
    action: "CLIENT_CREATED",
    entity: "Client",
    entityId: client.id,
    metadata: { fileNumber: client.fileNumber },
  });
  return client;
}

export type UpdateClientResult =
  | { ok: true; client: NonNullable<Awaited<ReturnType<typeof getClient>>> }
  | { ok: false; reason: "not_found" | "review_locked" };

export async function updateClient(
  tenantId: string,
  actorId: string,
  id: string,
  input: ClientInput
): Promise<UpdateClientResult> {
  const existing = await prisma.client.findFirst({ where: { id, tenantId } });
  if (!existing) return { ok: false, reason: "not_found" };
  if (existing.reviewComplete && input.reviewYears !== undefined && input.reviewYears !== existing.reviewYears) {
    return { ok: false, reason: "review_locked" };
  }
  const data = buildUpdateData(input);
  // Strip undefined so Prisma doesn't try to set columns to undefined.
  const clean: Prisma.ClientUpdateInput = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Prisma.ClientUpdateInput;
  const client = await prisma.client.update({
    where: { id },
    data: clean,
    include: {
      folderChecklist: { orderBy: { itemName: "asc" } },
      historicalReviews: { orderBy: [{ fiscalYear: "desc" }, { filingType: "asc" }] },
    },
  });
  await writeAudit({
    tenantId,
    actorId,
    action: "CLIENT_UPDATED",
    entity: "Client",
    entityId: client.id,
  });
  return { ok: true, client };
}

export async function deleteClient(tenantId: string, actorId: string, id: string) {
  const existing = await prisma.client.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  await prisma.client.update({ where: { id }, data: { active: false } });
  await writeAudit({
    tenantId,
    actorId,
    action: "CLIENT_DELETED",
    entity: "Client",
    entityId: id,
  });
  return true;
}

export async function setClientActive(
  tenantId: string,
  actorId: string,
  id: string,
  active: boolean
) {
  const existing = await prisma.client.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  await prisma.client.update({ where: { id }, data: { active } });
  await writeAudit({
    tenantId,
    actorId,
    action: active ? "CLIENT_REACTIVATED" : "CLIENT_DEACTIVATED",
    entity: "Client",
    entityId: id,
  });
  return { ok: true, active };
}

export async function setReviewComplete(tenantId: string, actorId: string, id: string, complete: boolean) {
  const existing = await prisma.client.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  await prisma.client.update({
    where: { id },
    data: { reviewComplete: complete },
  });
  await writeAudit({
    tenantId,
    actorId,
    action: complete ? "REVIEW_COMPLETED" : "REVIEW_REOPENED",
    entity: "Client",
    entityId: id,
  });
  return true;
}

export async function revealQbPassword(tenantId: string, actorId: string, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, tenantId },
    select: { qbPasswordEncrypted: true },
  });
  if (!client?.qbPasswordEncrypted) return null;
  if (!isEncryptedFormat(client.qbPasswordEncrypted)) {
    throw new Error("Stored value is not in an encrypted format.");
  }
  // Decryption happens in the route handler so the key material stays in that file.
  return client.qbPasswordEncrypted;
}
