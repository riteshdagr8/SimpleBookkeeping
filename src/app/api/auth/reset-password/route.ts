import { createHash } from "crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ token: z.string().min(1), password: z.string().min(8).max(200) });

export async function POST(request: Request) {
  // Throttle brute-force attempts against reset tokens per IP.
  if (!rateLimit(`reset:ip:${clientIp(request)}`, { limit: 10, windowMs: 15 * 60 * 1000 })) {
    return Response.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid token or password." }, { status: 400 });
  const tokenHash = createHash("sha256").update(parsed.data.token).digest("hex");
  const token = await prisma.passwordResetToken.findFirst({
    where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: true },
  });
  if (!token || !token.user.active) return Response.json({ error: "This reset link is invalid or expired." }, { status: 400 });

  const password = await hash(parsed.data.password, 12);
  // Claim the token inside the transaction with a conditional update. If two
  // requests race on the same token, only the one that flips usedAt from null
  // gets a count of 1 and changes the password.
  const claimed = await prisma.$transaction(async (tx) => {
    const r = await tx.passwordResetToken.updateMany({
      where: { id: token.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    if (r.count === 0) return false;
    await tx.user.update({ where: { id: token.userId }, data: { password } });
    return true;
  });
  if (!claimed) return Response.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  await writeAudit({ tenantId: token.user.tenantId, actorId: token.userId, action: "PASSWORD_RESET_COMPLETED", entity: "User", entityId: token.userId });
  return Response.json({ ok: true });
}
