import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { createSchema, createUser, listUsers } from "@/lib/services/users";

export async function GET() {
  const actor = await requireAdmin();
  const users = await listUsers(actor.tenantId);
  return NextResponse.json({ users });
}

export async function POST(req: Request) {
  const actor = await requireAdmin();
  const body = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const result = await createUser(actor.tenantId, actor.id, parsed.data);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ user: result.user });
}
