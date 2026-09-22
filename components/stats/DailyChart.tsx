"use client";

import { useState } from "react";

type Row = { date: string; count: number };

function formatDate(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export default function DailyChart({ rows }: { rows: Row[] }) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  if (rows.length === 0) {
    return (
      <p className="text-[0.82rem] text-muted-2">No activity recorded yet.</p>
    );
  }

  const max = Math.max(...rows.map((r) => r.count), 1);
  const hovered = hoveredIndex !== null ? rows[hoveredIndex] : null;

  return (
    <div>
      <div className="mb-2 h-5 text-[0.72rem] text-accent">
        {hovered && (
          <span>
            {formatDate(hovered.date)} — {hovered.count}{" "}
            {hovered.count === 1 ? "question" : "questions"}
          </span>
        )}
      </div>
      <div className="flex h-28 items-end gap-1">
        {rows.map((row, i) => {
          const heightPct = Math.max((row.count / max) * 100, 4);
          const isHovered = hoveredIndex === i;
          return (
            <div
              key={row.date}
              className="group flex h-full flex-1 flex-col justify-end"
              onMouseEnter={() => setHoveredIndex(i)}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <div
                className={`w-full rounded-t-[3px] transition-colors ${
                  isHovered
                    ? "bg-accent"
                    : "bg-accent-soft group-hover:bg-accent/70"
                }`}
                style={{ height: `${heightPct}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[0.65rem] text-muted-2">
        <span>{formatDate(rows[0].date)}</span>
        {rows.length > 1 && (
          <span>{formatDate(rows[rows.length - 1].date)}</span>
        )}
      </div>
    </div>
  );
}
