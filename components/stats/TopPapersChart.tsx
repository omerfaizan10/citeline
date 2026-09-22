"use client";

import { useState } from "react";
import type { Paper } from "@/lib/types";

type Row = { paperId: string; count: number; paper?: Paper };

export default function TopPapersChart({ rows }: { rows: Row[] }) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(...rows.map((r) => r.count), 1);

  if (rows.length === 0) {
    return (
      <p className="text-[0.82rem] text-muted-2">
        No questions answered yet. Once people start asking, the most-retrieved
        papers will show up here.
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const widthPct = Math.max((row.count / max) * 100, 4);
        const isHovered = hovered === row.paperId;
        return (
          <div
            key={row.paperId}
            className="group"
            onMouseEnter={() => setHovered(row.paperId)}
            onMouseLeave={() => setHovered(null)}
          >
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span className="truncate text-[0.8rem] text-foreground/90">
                {row.paper?.title ?? row.paperId}
              </span>
              <span
                className={`shrink-0 text-[0.72rem] tabular-nums transition-colors ${
                  isHovered ? "text-accent" : "text-muted-2"
                }`}
              >
                {row.count} {row.count === 1 ? "question" : "questions"}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-accent-soft">
              <div
                className="h-full rounded-full bg-accent transition-[width]"
                style={{ width: `${widthPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
