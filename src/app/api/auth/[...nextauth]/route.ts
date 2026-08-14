import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const handler = NextAuth(authOptions);

export { handler as GET };

// Throttle credential sign-in attempts. Keyed per-IP+email (5/15min) and
// per-IP (20/15min) so a targeted attack is slowed without letting one shared
// bucket be exhausted by a single noisy IP.
export async function POST(
  request: Request,
  ctx: { params: Promise<{ nextauth: string[] }> }
): Promise<Response> {
  const path = new URL(request.url).pathname;
  if (path.includes("/callback/credentials")) {
    const ip = clientIp(request);
    if (!rateLimit(`login:ip:${ip}`, { limit: 20, windowMs: 15 * 60 * 1000 })) {
      return new Response("Too many attempts. Please wait and try again.", { status: 429 });
    }
    const body = await request.clone().text();
    const email = decodeURIComponent(/email=([^&]*)/.exec(body)?.[1] ?? "").toLowerCase();
    if (email && !rateLimit(`login:ip:${ip}:${email}`, { limit: 5, windowMs: 15 * 60 * 1000 })) {
      return new Response("Too many attempts. Please wait and try again.", { status: 429 });
    }
  }
  return handler(request, ctx);
}
