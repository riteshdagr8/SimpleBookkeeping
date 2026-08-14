/**
 * Minimal in-memory sliding-window rate limiter.
 *
 * Suitable for the single-instance dev server / standalone container this app
 * ships as. If the app is ever deployed multi-instance or to serverless,
 * back this with a shared store (e.g. Redis) instead of module state.
 */

interface Bucket {
  times: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  limit: number;
  windowMs: number;
}

/**
 * Returns true if `key` is within its allowance; false if it should be
 * rejected (too many calls within `windowMs`).
 */
export function rateLimit(key: string, opts: RateLimitOptions): boolean {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const bucket = buckets.get(key) ?? { times: [] as number[] };
  bucket.times = bucket.times.filter((t) => t > cutoff);
  if (bucket.times.length >= opts.limit) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.times.push(now);
  buckets.set(key, bucket);

  // Opportunistic cleanup so the map can't grow without bound.
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) {
      if (b.times.length === 0 || b.times[b.times.length - 1] <= cutoff) buckets.delete(k);
    }
  }
  return true;
}

/** Best-effort client IP from reverse-proxy headers (set by nginx/Caddy/tunnel). */
export function clientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
