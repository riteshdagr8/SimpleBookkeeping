import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { setClientActive } from "@/lib/services/clients";

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const result = await setClientActive(user.tenantId, user.id, id, true);
  if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(result);
}
