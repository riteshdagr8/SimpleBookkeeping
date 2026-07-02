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
  fileNumber: z.string().min(1).max(40),
  legalName: z.string().min(1).max(200),
  businessNumber: z.string().max(40).optional().nullable(),
  entityType: z.string().max(40).optional().nullable(),
  fiscalYearEnd: dateOnly,
  incorporationDate: dateOnly.optional().nullable(),
  incorporationJurisdiction: z.enum(["Federal", "Ontario"]).optional().nullable(),
  address: z.string().max(400).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  email: z.string().email().max(200).optional().nullable(),
  folderPath: z.string().max(1000).optional().nullable(),
  qbPassword: z.string().max(200).optional().nullable(),
  hstApplicable: z.boolean().optional(),
  hstFrequency: z.enum(["Monthly", "Quarterly", "Annual"]).optional().nullable(),
  payrollApplicable: z.boolean().optional(),
  payrollFrequency: z.string().max(40).optional().nullable(),
  remitterType: z.enum(["Regular", "Quarterly"]).optional().nullable(),
  threeMonthEligible: z.boolean().optional(),
  notes: z.string().max(2000).optional().nullable(),
});

export type ClientInput = z.infer<typeof clientInputSchema>;

function buildCreateData(input: ClientInput, tenantId: string): Prisma.ClientUncheckedCreateInput {
  return {
    tenantId,
    fileNumber: input.fileNumber.trim(),
    legalName: input.legalName.trim(),
    businessNumber: input.businessNumber ?? null,
    entityType: input.entityType ?? null,
    fiscalYearEnd: input.fiscalYearEnd,
    incorporationDate: input.incorporationDate ?? null,
    incorporationJurisdiction: input.incorporationJurisdiction ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    folderPath: input.folderPath ?? null,
    hstApplicable: input.hstApplicable ?? false,
    hstFrequency: input.hstApplicable ? input.hstFrequency ?? null : null,
    payrollApplicable: input.payrollApplicable ?? false,
    payrollFrequency: input.payrollApplicable ? input.payrollFrequency ?? null : null,
    remitterType: input.payrollApplicable ? input.remitterType ?? null : null,
    threeMonthEligible: input.threeMonthEligible ?? false,
    notes: input.notes ?? null,
    qbPasswordEncrypted: resolveQb(input.qbPassword),
  };
}

function buildUpdateData(input: ClientInput): Prisma.ClientUpdateInput {
  return {
    fileNumber: input.fileNumber.trim(),
    legalName: input.legalName.trim(),
    businessNumber: input.businessNumber ?? null,
    entityType: input.entityType ?? null,
    fiscalYearEnd: input.fiscalYearEnd,
    incorporationDate: input.incorporationDate ?? null,
    incorporationJurisdiction: input.incorporationJurisdiction ?? null,
    address: input.address ?? null,
    phone: input.phone ?? null,
    email: input.email ?? null,
    folderPath: input.folderPath ?? null,
    hstApplicable: input.hstApplicable ?? false,
    hstFrequency: input.hstApplicable ? input.hstFrequency ?? null : null,
    payrollApplicable: input.payrollApplicable ?? false,
    payrollFrequency: input.payrollApplicable ? input.payrollFrequency ?? null : null,
    remitterType: input.payrollApplicable ? input.remitterType ?? null : null,
    threeMonthEligible: input.threeMonthEligible ?? false,
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
    where: { tenantId, active: true },
    orderBy: [{ fileNumber: "asc" }],
    select: {
      id: true,
      fileNumber: true,
      legalName: true,
      fiscalYearEnd: true,
      businessNumber: true,
      reviewComplete: true,
      onboardingStatus: true,
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
  const client = await prisma.client.create({ data });
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

export async function updateClient(tenantId: string, actorId: string, id: string, input: ClientInput) {
  const existing = await prisma.client.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  const data = buildUpdateData(input);
  // Strip undefined so Prisma doesn't try to set columns to undefined.
  const clean: Prisma.ClientUpdateInput = Object.fromEntries(
    Object.entries(data).filter(([, v]) => v !== undefined)
  ) as Prisma.ClientUpdateInput;
  const client = await prisma.client.update({ where: { id }, data: clean });
  await writeAudit({
    tenantId,
    actorId,
    action: "CLIENT_UPDATED",
    entity: "Client",
    entityId: client.id,
  });
  return client;
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

export async function setReviewComplete(tenantId: string, actorId: string, id: string, complete: boolean) {
  const existing = await prisma.client.findFirst({ where: { id, tenantId } });
  if (!existing) return null;
  await prisma.client.update({
    where: { id },
    data: { reviewComplete: complete, onboardingStatus: complete ? "Complete" : "Pending" },
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
