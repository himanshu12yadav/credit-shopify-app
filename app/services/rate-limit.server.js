/**
 * Lightweight in-memory fixed-window rate limiter for public routes that
 * aren't worth provisioning external infra (Redis) for. Per-process only —
 * acceptable for a single-instance deployment and as a first line of
 * defense; it resets on restart and doesn't share state across instances.
 */
const buckets = new Map(); // key -> { count, windowStart }

export function isRateLimited(key, { windowMs = 60_000, max = 60 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    if (buckets.size > 5000) {
      for (const [k, v] of buckets) {
        if (now - v.windowStart >= windowMs) buckets.delete(k);
      }
    }
    return false;
  }

  bucket.count += 1;
  return bucket.count > max;
}

export function getClientIp(request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();
  return request.headers.get("x-real-ip") || "unknown";
}
