/**
 * Best-effort public origin (scheme://host) for building absolute links.
 *
 * Next.js builds `request.url` from the server's listen address, so when the
 * dev server binds 0.0.0.0 it yields `http://0.0.0.0:3100` — useless for
 * links emailed to users. Resolution order:
 *   1. PUBLIC_BASE_URL (explicit public origin — required when the app is
 *      reached through a Cloudflare tunnel / reverse proxy that rewrites the
 *      Host header to localhost, or is administered locally while users are
 *      elsewhere).
 *   2. NEXTAUTH_URL (existing documented override, kept for back-compat).
 *   3. The Host header the browser actually sent (the app already trusts it
 *      via AUTH_TRUST_HOST, matching NextAuth's own origin detection).
 */
export function requestOrigin(request: Request): string {
  const configured = process.env.PUBLIC_BASE_URL?.trim() || process.env.NEXTAUTH_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}
