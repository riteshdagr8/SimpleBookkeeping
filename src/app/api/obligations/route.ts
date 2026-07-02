import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { listObligationsForTenant } from "@/lib/services/obligations";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
  const status = searchParams.get("status") ?? undefined;
  const filingType = searchParams.get("filingType") ?? undefined;
  const result = await listObligationsForTenant(user.tenantId, {
    from: fromStr ? new Date(fromStr) : undefined,
    to: toStr ? new Date(toStr) : undefined,
    status: status || undefined,
    filingType: filingType || undefined,
  });
  return NextResponse.json(result);
}
