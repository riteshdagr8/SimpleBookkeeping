import { NextResponse } from "next/server";
import { requireUser, requireAdmin } from "@/lib/auth";
import { clientInputSchema, getClient, updateClient, deleteClient } from "@/lib/services/clients";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const client = await getClient(user.tenantId, id);
  if (!client) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Staff cannot view inactive clients.
  if (!client.active && user.role !== "Admin") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ client });
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = clientInputSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }
  const existing = await getClient(user.tenantId, id);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  // Staff cannot edit inactive clients.
  if (!existing.active && user.role !== "Admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const result = await updateClient(user.tenantId, user.id, id, parsed.data);
  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(
      { error: "Review is complete — unmark 'Review complete' before changing the year count." },
      { status: 400 }
    );
  }
  return NextResponse.json({ client: result.client });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireAdmin();
  const { id } = await params;
  const ok = await deleteClient(user.tenantId, user.id, id);
  if (!ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
