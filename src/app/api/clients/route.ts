import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { clientInputSchema, createClient, listClients } from "@/lib/services/clients";

export async function GET() {
  const user = await requireUser();
  const clients = await listClients(user.tenantId);
  return NextResponse.json({ clients });
}

export async function POST(req: Request) {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = clientInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  try {
    const client = await createClient(user.tenantId, user.id, parsed.data);
    return NextResponse.json({ client });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Create failed";
    const status = message.includes("Unique constraint") ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
