import "server-only";
import { Redis } from "@upstash/redis";

let client: Redis | null | undefined;

/**
 * Lazily built, and undefined-safe: the stats feature is optional. Without
 * UPSTASH_REDIS_REST_URL/TOKEN set (e.g. local dev, CI, or before the
 * Upstash integration is connected on Vercel), this returns null and every
 * caller treats that as "stats aren't available right now" rather than
 * throwing.
 */
export function getRedis(): Redis | null {
  if (client !== undefined) return client;
  const hasEnv =
    (process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
    (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN);
  client = hasEnv ? Redis.fromEnv() : null;
  return client;
}
