import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  resetUserPassword,
  setUserActive,
} from "@/lib/services/users";

const patchSchema = z.object({
  active: z.boolean().optional(),
  password: z.string().min(8).max(200).optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const actor = await requireAdmin();
  const { id } = await params;
  const body = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  if (typeof parsed.data.active === "boolean") {
    if (id === actor.id && parsed.data.active === false) {
      return NextResponse.json(
        { error: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }
    const result = await setUserActive(actor.tenantId, actor.id, id, parsed.data.active);
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (typeof parsed.data.password === "string") {
    const result = await resetUserPassword(actor.tenantId, actor.id, id, {
      password: parsed.data.password,
    });
    if (!result) return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
