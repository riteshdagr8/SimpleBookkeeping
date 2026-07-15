import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateObligation, updateSchema } from "@/lib/services/obligations";

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string; obligationId: string }> }
) {
  const user = await requireUser();
  const { id, obligationId } = await params;
  const body = await req.json().catch(() => null);
  const parsed = updateSchema.safeParse(body ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const updated = await updateObligation(user.tenantId, user.id, id, obligationId, parsed.data);
  if (!updated) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ obligation: updated });
}
