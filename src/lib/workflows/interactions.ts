import { prisma } from "@/lib/prisma";
import type { WorkflowType } from "./types";

export type InteractionStatus = "Pending" | "Closed";

export interface ClientInteraction {
  id: string;
  tenantId: string;
  targetType: string;
  targetId: string;
  dateInitiated: Date;
  dateClosed: Date | null;
  note: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Find the currently-open interaction for a workflow target (if any).
 * Returns null if there is no Pending interaction.
 */
export async function getActiveInteraction(
  targetType: string,
  targetId: string
): Promise<ClientInteraction | null> {
  return prisma.clientInteraction.findFirst({
    where: { targetType, targetId, status: "Pending" },
  });
}

/**
 * Open a new interaction. If one is already open for the same target, return
 * the existing one (idempotent). When `note` is provided it overwrites the
 * stored note, including with an empty string (a cleared note). When `note` is
 * undefined the stored note is left unchanged.
 */
export async function openInteraction(
  tenantId: string,
  targetType: WorkflowType,
  targetId: string,
  note: string | undefined
): Promise<ClientInteraction> {
  const existing = await prisma.clientInteraction.findFirst({
    where: { targetType, targetId, status: "Pending" },
  });
  if (existing) {
    if (note === undefined || (note || null) === existing.note) return existing;
    return prisma.clientInteraction.update({
      where: { id: existing.id },
      data: { note: note || null },
    });
  }
  return prisma.clientInteraction.create({
    data: {
      tenantId,
      targetType,
      targetId,
      note: note || null,
      status: "Pending",
    },
  });
}

/**
 * Close the open interaction for a target. Returns the closed record, or null
 * if there was nothing to close.
 */
export async function closeInteraction(
  targetType: string,
  targetId: string
): Promise<ClientInteraction | null> {
  const existing = await prisma.clientInteraction.findFirst({
    where: { targetType, targetId, status: "Pending" },
  });
  if (!existing) return null;
  return prisma.clientInteraction.update({
    where: { id: existing.id },
    data: { status: "Closed", dateClosed: new Date() },
  });
}
