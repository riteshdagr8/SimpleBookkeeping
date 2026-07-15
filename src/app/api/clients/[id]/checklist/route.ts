import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";

const putSchema = z.object({
  itemName: z.string().min(1).max(100),
  created: z.boolean(),
});

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }
  const client = await prisma.client.findFirst({ where: { id, tenantId: user.tenantId } });
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const item = await prisma.folderChecklistItem.upsert({
    where: { clientId_itemName: { clientId: id, itemName: parsed.data.itemName } },
    update: { created: parsed.data.created },
    create: { clientId: id, itemName: parsed.data.itemName, created: parsed.data.created },
  });
  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "CHECKLIST_UPDATED",
    entity: "Client",
    entityId: id,
    metadata: { itemName: parsed.data.itemName, created: parsed.data.created },
  });
  return NextResponse.json({ item });
}
