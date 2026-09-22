import "server-only";

/**
 * In-memory sliding-window limiter, keyed by IP.
 *
 * This is a deliberate trade-off: Vercel serverless functions are stateless
 * and can run as several parallel instances, so this map isn't shared across
 * them and resets on every cold start. That means a determined attacker
 * spread across instances could exceed the nominal limit. For this project's
 * traffic level it's enough to stop casual abuse and accidental loops without
 * standing up Redis. A real production deployment would move this to
 * Upstash/Vercel KV to get a single shared counter.
 */

export const WINDOW_MS = 10 * 60 * 1000;
export const MAX_REQUESTS = 40;

const hits = new Map<string, number[]>();

// Bound memory: drop the oldest keys once the map grows past this size,
// since long-idle IPs would otherwise accumulate forever between cold starts.
const MAX_TRACKED_IPS = 5000;

export type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds?: number;
};

// Vercel always resolves a real client IP via x-forwarded-for, so a
// loopback key only ever shows up in local dev/testing -- never for a real
// visitor. Exempting it means the eval script and manual local testing
// don't trip the limiter and mask genuine results.
const LOOPBACK_KEYS = new Set(["127.0.0.1", "::1"]);

export function checkRateLimit(key: string): RateLimitResult {
  if (LOOPBACK_KEYS.has(key)) return { allowed: true };

  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (timestamps.length >= MAX_REQUESTS) {
    const retryAfterMs = timestamps[0] + WINDOW_MS - now;
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(retryAfterMs / 1000),
    };
  }

  timestamps.push(now);
  hits.set(key, timestamps);

  if (hits.size > MAX_TRACKED_IPS) {
    const oldestKey = hits.keys().next().value;
    if (oldestKey !== undefined) hits.delete(oldestKey);
  }

  return { allowed: true };
}

export function getClientKey(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
