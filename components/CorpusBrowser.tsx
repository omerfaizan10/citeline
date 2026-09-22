"use client";

import { useMemo, useState } from "react";
import type { Paper } from "@/lib/types";
import { groupByTopic } from "@/lib/papers";

export default function CorpusBrowser({ papers }: { papers: Paper[] }) {
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<string | null>(null);

  const topics = useMemo(
    () => Array.from(new Set(papers.map((p) => p.topic))).sort(),
    [papers],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return papers.filter((p) => {
      if (topic && p.topic !== topic) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.authors.toLowerCase().includes(q) ||
        p.topic.toLowerCase().includes(q)
      );
    });
  }, [papers, query, topic]);

  const groups = groupByTopic(filtered);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, or topic…"
          className="flex-1 rounded-lg border border-border-strong bg-surface-raised px-3.5 py-2 text-[0.88rem] text-foreground placeholder:text-muted-2 focus:border-accent focus:outline-none"
        />
        <select
          value={topic ?? ""}
          onChange={(e) => setTopic(e.target.value || null)}
          className="rounded-lg border border-border-strong bg-surface-raised px-3 py-2 text-[0.82rem] text-foreground focus:border-accent focus:outline-none"
        >
          <option value="">All topics</option>
          {topics.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </div>

      <p className="mt-4 text-[0.72rem] text-muted-2">
        {filtered.length} of {papers.length} papers
      </p>

      <div className="mt-6 space-y-8">
        {groups.map(([groupTopic, items]) => (
          <div key={groupTopic}>
            <h2 className="mb-3 text-[0.72rem] font-medium uppercase tracking-[0.1em] text-muted">
              {groupTopic}
            </h2>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {items.map((paper) => (
                <a
                  key={paper.id}
                  href={`https://arxiv.org/abs/${paper.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group rounded-lg border border-border bg-surface px-3.5 py-3 transition-colors hover:border-accent"
                >
                  <span className="block text-[0.85rem] leading-snug text-foreground/90 transition-colors group-hover:text-accent">
                    {paper.title}
                  </span>
                  <span className="mt-1 block text-[0.72rem] text-muted-2">
                    {paper.authors} &middot; {paper.year}
                  </span>
                </a>
              ))}
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <p className="text-[0.85rem] text-muted-2">
            No papers match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}
