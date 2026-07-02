import { z } from "zod";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(200),
  role: z.enum(["Admin", "Staff"]),
  password: z.string().min(8).max(200),
});

const resetSchema = z.object({
  password: z.string().min(8).max(200),
});

export { createSchema, resetSchema };

export type CreateUserInput = z.infer<typeof createSchema>;
export type ResetPasswordInput = z.infer<typeof resetSchema>;

export async function listUsers(tenantId: string) {
  return prisma.user.findMany({
    where: { tenantId },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      theme: true,
      createdAt: true,
    },
  });
}

export async function createUser(tenantId: string, actorId: string, input: CreateUserInput) {
  const normalizedEmail = input.email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) return { error: "A user with that email already exists." as const };
  const hashed = await hash(input.password, 12);
  const user = await prisma.user.create({
    data: {
      tenantId,
      email: normalizedEmail,
      name: input.name.trim(),
      role: input.role,
      password: hashed,
      active: true,
    },
    select: { id: true, name: true, email: true, role: true },
  });
  await writeAudit({
    tenantId,
    actorId,
    action: "USER_CREATED",
    entity: "User",
    entityId: user.id,
    metadata: { email: user.email, role: user.role },
  });
  return { user };
}

export async function setUserActive(tenantId: string, actorId: string, id: string, active: boolean) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) return null;
  await prisma.user.update({ where: { id }, data: { active } });
  await writeAudit({
    tenantId,
    actorId,
    action: active ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    entity: "User",
    entityId: id,
  });
  return { ok: true, active };
}

export async function resetUserPassword(
  tenantId: string,
  actorId: string,
  id: string,
  input: ResetPasswordInput
) {
  const user = await prisma.user.findFirst({ where: { id, tenantId } });
  if (!user) return null;
  const hashed = await hash(input.password, 12);
  await prisma.user.update({ where: { id }, data: { password: hashed } });
  await writeAudit({
    tenantId,
    actorId,
    action: "USER_PASSWORD_RESET",
    entity: "User",
    entityId: id,
  });
  return { ok: true };
}
