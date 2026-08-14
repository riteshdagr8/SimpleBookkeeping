import { randomBytes, createHash } from "crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/services/audit";
import { sendPasswordResetEmail } from "@/lib/email";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const schema = z.object({ email: z.string().email().max(200) });

export async function POST(request: Request) {
  // Throttle per IP and per email to prevent email bombing / token spam.
  if (!rateLimit(`forgot:ip:${clientIp(request)}`, { limit: 5, windowMs: 15 * 60 * 1000 })) {
    return Response.json({ ok: true }, { status: 429 });
  }

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: true });

  const email = parsed.data.email.toLowerCase().trim();
  if (!rateLimit(`forgot:email:${email}`, { limit: 3, windowMs: 60 * 60 * 1000 })) {
    return Response.json({ ok: true }, { status: 429 });
  }
  const user = await prisma.user.findFirst({ where: { email, active: true } });
  if (user) {
    const rawToken = randomBytes(32).toString("hex");
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");
    await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000) },
    });
    const origin = process.env.NEXTAUTH_URL || new URL(request.url).origin;
    const resetUrl = `${origin}/reset-password?token=${encodeURIComponent(rawToken)}`;
    await sendPasswordResetEmail(user.email, resetUrl);
    await writeAudit({ tenantId: user.tenantId, actorId: user.id, action: "PASSWORD_RESET_REQUESTED", entity: "User", entityId: user.id });
  }
  return Response.json({ ok: true });
}
