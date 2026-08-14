/**
 * Best-effort public origin (scheme://host) for the incoming request.
 *
 * Next.js builds `request.url` from the server's listen address, so when the
 * dev server binds 0.0.0.0 it yields `http://0.0.0.0:3100` — useless for
 * links emailed to users. Use the Host header the browser actually sent
 * instead (the app already trusts it via AUTH_TRUST_HOST, matching
 * NextAuth's own origin detection).
 */
export function requestOrigin(request: Request): string {
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  if (host) {
    const proto = request.headers.get("x-forwarded-proto") || "http";
    return `${proto}://${host}`;
  }
  return new URL(request.url).origin;
}
