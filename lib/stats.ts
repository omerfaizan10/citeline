import "server-only";
import { getRedis } from "./redis";

const MAX_RECENT_EVENTS = 50;

export type AskEvent = {
  outcome: "ok" | "error" | "rate_limited" | "stream_error";
  questionPreview?: string;
  citedPapers?: string[];
  topScore?: number | null;
  answerLength?: number;
  latencyMs?: number;
  timestamp: string; // ISO
};

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD, UTC
}

/**
 * Best-effort: stats are a nice-to-have, never allowed to affect whether a
 * question gets answered. Every write is wrapped so a Redis hiccup (or
 * stats simply not being configured) never surfaces to the user.
 */
export async function recordEvent(event: AskEvent): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const pipeline = redis.pipeline();
    pipeline.incr(`stats:count:${event.outcome}`);
    pipeline.zincrby("stats:daily", 1, todayKey());

    if (event.outcome === "ok") {
      if (typeof event.latencyMs === "number") {
        pipeline.incrby("stats:latencySumMs", Math.round(event.latencyMs));
        pipeline.incr("stats:latencyCount");
      }
      for (const paperId of event.citedPapers ?? []) {
        pipeline.hincrby("stats:paperCounts", paperId, 1);
      }
    }

    // @upstash/redis auto-serializes non-string values (and auto-parses
    // them back on read) -- pushing the object directly and letting the
    // client handle it avoids double-encoding.
    pipeline.lpush("stats:recentEvents", event);
    pipeline.ltrim("stats:recentEvents", 0, MAX_RECENT_EVENTS - 1);

    await pipeline.exec();
  } catch (err) {
    console.error("stats: failed to record event", err);
  }
}

export type StatsSummary = {
  configured: boolean;
  totalQuestions: number;
  totalErrors: number;
  totalRateLimited: number;
  avgLatencyMs: number | null;
  topPapers: { paperId: string; count: number }[];
  dailyCounts: { date: string; count: number }[];
  recentEvents: AskEvent[];
};

export async function getStatsSummary(): Promise<StatsSummary> {
  const redis = getRedis();
  if (!redis) {
    return {
      configured: false,
      totalQuestions: 0,
      totalErrors: 0,
      totalRateLimited: 0,
      avgLatencyMs: null,
      topPapers: [],
      dailyCounts: [],
      recentEvents: [],
    };
  }

  const [
    totalQuestions,
    totalErrors,
    totalRateLimited,
    latencySum,
    latencyCount,
    paperCounts,
    dailyRaw,
    recentRaw,
  ] = await Promise.all([
    redis.get<number>("stats:count:ok"),
    redis.get<number>("stats:count:error"),
    redis.get<number>("stats:count:rate_limited"),
    redis.get<number>("stats:latencySumMs"),
    redis.get<number>("stats:latencyCount"),
    redis.hgetall<Record<string, number>>("stats:paperCounts"),
    redis.zrange("stats:daily", 0, -1, { withScores: true }),
    redis.lrange<AskEvent>("stats:recentEvents", 0, MAX_RECENT_EVENTS - 1),
  ]);

  const topPapers = Object.entries(paperCounts ?? {})
    .map(([paperId, count]) => ({ paperId, count: Number(count) }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const dailyCounts: { date: string; count: number }[] = [];
  for (let i = 0; i < dailyRaw.length; i += 2) {
    dailyCounts.push({
      date: String(dailyRaw[i]),
      count: Number(dailyRaw[i + 1]),
    });
  }
  dailyCounts.sort((a, b) => a.date.localeCompare(b.date));

  const recentEvents = recentRaw.filter(
    (e): e is AskEvent => e !== null && typeof e === "object",
  );

  return {
    configured: true,
    totalQuestions: totalQuestions ?? 0,
    totalErrors: totalErrors ?? 0,
    totalRateLimited: totalRateLimited ?? 0,
    avgLatencyMs:
      latencyCount && latencyCount > 0
        ? Math.round((latencySum ?? 0) / latencyCount)
        : null,
    topPapers,
    dailyCounts,
    recentEvents,
  };
}
