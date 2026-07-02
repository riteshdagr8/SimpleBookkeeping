import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth";
import { isThemeId } from "@/lib/theme";

const putSchema = z.object({ theme: z.string().refine(isThemeId, "Unknown theme") });

export async function GET() {
  const user = await requireUser();
  const u = await prisma.user.findUnique({ where: { id: user.id }, select: { theme: true } });
  return NextResponse.json({ theme: u?.theme ?? "cloud-white" });
}

export async function PUT(req: Request) {
  const user = await requireUser();
  const body = await req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid" }, { status: 400 });
  }
  await prisma.user.update({
    where: { id: user.id },
    data: { theme: parsed.data.theme },
  });
  return NextResponse.json({ theme: parsed.data.theme });
}
