import Link from "next/link";
import { getStatsSummary } from "@/lib/stats";
import papers from "@/data/papers.json";
import StatTile from "@/components/stats/StatTile";
import TopPapersChart from "@/components/stats/TopPapersChart";
import DailyChart from "@/components/stats/DailyChart";

export const dynamic = "force-dynamic";

function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function StatsPage() {
  const stats = await getStatsSummary();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[720px] px-6 py-10 md:px-8">
        <Link
          href="/"
          className="text-[0.78rem] text-muted-2 transition-colors hover:text-accent"
        >
          ← Back to Citeline
        </Link>

        <h1 className="mt-4 font-serif text-2xl text-foreground">
          Usage stats
        </h1>
        <p className="mt-1.5 text-[0.85rem] text-muted">
          What people are actually asking, and whether retrieval is finding
          anything — logged from real requests, not simulated.
        </p>

        {!stats.configured ? (
          <div className="mt-8 rounded-xl border border-border bg-surface px-4 py-4 text-[0.85rem] text-muted">
            Stats aren&apos;t configured yet — this page reads from Upstash
            Redis, which hasn&apos;t been connected to this deployment. Once it
            is (and a few questions have been asked), real numbers will show up
            here.
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Questions answered"
                value={stats.totalQuestions.toLocaleString()}
              />
              <StatTile
                label="Avg latency"
                value={
                  stats.avgLatencyMs !== null
                    ? `${(stats.avgLatencyMs / 1000).toFixed(1)}s`
                    : "—"
                }
              />
              <StatTile
                label="Errors"
                value={stats.totalErrors.toLocaleString()}
              />
              <StatTile
                label="Rate limited"
                value={stats.totalRateLimited.toLocaleString()}
              />
            </div>

            <section className="mt-10">
              <h2 className="mb-3 text-[0.7rem] uppercase tracking-[0.12em] text-muted-2">
                Questions per day
              </h2>
              <DailyChart rows={stats.dailyCounts} />
            </section>

            <section className="mt-10">
              <h2 className="mb-3 text-[0.7rem] uppercase tracking-[0.12em] text-muted-2">
                Most-retrieved papers
              </h2>
              <TopPapersChart
                rows={stats.topPapers.map((r) => ({
                  ...r,
                  paper: papers.find((p) => p.id === r.paperId),
                }))}
              />
            </section>

            {stats.recentEvents.length > 0 && (
              <section className="mt-10">
                <h2 className="mb-3 text-[0.7rem] uppercase tracking-[0.12em] text-muted-2">
                  Recent questions
                </h2>
                <ul className="space-y-3">
                  {stats.recentEvents.slice(0, 10).map((e, i) => (
                    <li
                      key={i}
                      className="border-b border-border pb-3 text-[0.82rem] last:border-none"
                    >
                      <div className="text-foreground/90">
                        {e.questionPreview ?? (
                          <span className="italic text-muted-2">
                            ({e.outcome})
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-[0.7rem] text-muted-2">
                        {timeAgo(e.timestamp)}
                        {e.citedPapers && e.citedPapers.length > 0 && (
                          <> · {e.citedPapers.length} papers cited</>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}
