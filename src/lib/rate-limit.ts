/**
 * Per-instance in-memory throttle. Not durable across cold starts or
 * multiple concurrent Vercel instances — a best-effort speed bump for
 * brute-forceable or costly endpoints, not a hard guarantee.
 */
const buckets = new Map<string, { count: number; resetAt: number }>();

export function isRateLimited(
  key: string,
  { max, windowMs }: { max: number; windowMs: number }
): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  bucket.count += 1;
  return bucket.count > max;
}
