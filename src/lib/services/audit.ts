import { prisma } from "@/lib/prisma";

export interface AuditInput {
  tenantId: string;
  actorId: string;
  action: string;
  entity?: string;
  entityId?: string;
  metadata?: Record<string, unknown>;
}

export async function writeAudit(input: AuditInput) {
  await prisma.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      action: input.action,
      entity: input.entity,
      entityId: input.entityId,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  });
}
