import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decrypt, isEncryptedFormat } from "@/lib/services/crypto";
import { writeAudit } from "@/lib/services/audit";
import { requireUser } from "@/lib/auth";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ clientId: string }> }
) {
  const user = await requireUser();
  const { clientId } = await params;

  const client = await prisma.client.findFirst({
    where: { id: clientId, tenantId: user.tenantId },
    select: { id: true, qbPasswordEncrypted: true },
  });

  if (!client) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!client.qbPasswordEncrypted) {
    return NextResponse.json({ password: "" });
  }
  if (!isEncryptedFormat(client.qbPasswordEncrypted)) {
    return NextResponse.json(
      { error: "Stored value is not in an encrypted format." },
      { status: 500 }
    );
  }

  const password = decrypt(client.qbPasswordEncrypted);

  await writeAudit({
    tenantId: user.tenantId,
    actorId: user.id,
    action: "QB_PASSWORD_REVEALED",
    entity: "Client",
    entityId: client.id,
  });

  return NextResponse.json({ password });
}
