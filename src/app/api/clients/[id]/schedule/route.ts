import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { generateObligationsForClient } from "@/lib/services/obligations";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const result = await generateObligationsForClient(user.tenantId, user.id, id);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ count: result.count });
}
