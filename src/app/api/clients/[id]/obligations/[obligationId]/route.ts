import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateObligation } from "@/lib/services/obligations";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; obligationId: string }> }
) {
  const user = await requireUser();
  const { id, obligationId } = await params;
  const body = await req.json().catch(() => null);
  const updated = await updateObligation(user.tenantId, user.id, id, obligationId, body ?? {});
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ obligation: updated });
}
