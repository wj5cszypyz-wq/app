// Simple fixed-window limiter kept in server memory. Good for one server; use Redis if you run several.
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

/** Returns seconds to wait if the key is over its limit, else 0 (and counts the attempt). */
export function hit(key: string, limit: number, windowMs: number): number {
  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return 0;
  }
  b.count++;
  return b.count > limit ? Math.ceil((b.resetAt - now) / 1000) : 0;
}

export function reset(key: string) {
  buckets.delete(key);
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  return (fwd?.split(",")[0] ?? req.headers.get("x-real-ip") ?? "local").trim().slice(0, 64);
}
