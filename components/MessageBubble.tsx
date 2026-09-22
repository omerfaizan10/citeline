"use client";

import { useState } from "react";
import type { ChatMessage, Citation } from "@/lib/types";

function CitationChip({ citation }: { citation: Citation }) {
  const [expanded, setExpanded] = useState(false);
  const matchPercent = Math.round(citation.score * 100);

  return (
    <div className="rounded-xl border border-border bg-surface">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="group flex w-full items-center gap-2 px-3 py-1.5 text-left"
      >
        <span className="max-w-[200px] truncate text-[0.72rem] text-muted group-hover:text-accent">
          {citation.title}
        </span>
        <span className="text-[0.68rem] text-muted-2">{citation.year}</span>
        <span
          title="Cosine similarity between your question and this excerpt"
          className="ml-auto shrink-0 rounded-full bg-accent-soft px-1.5 py-0.5 text-[0.62rem] font-medium text-accent"
        >
          {matchPercent}% match
        </span>
      </button>

      {expanded && (
        <div className="border-t border-border px-3 py-2.5">
          <p className="text-[0.78rem] leading-relaxed text-muted">
            &ldquo;{citation.snippet}&rdquo;
          </p>
          <a
            href={`https://arxiv.org/abs/${citation.paperId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 inline-block text-[0.72rem] text-accent hover:underline"
          >
            View on arXiv →
          </a>
        </div>
      )}
    </div>
  );
}

export default function MessageBubble({
  message,
  isStreaming,
}: {
  message: ChatMessage;
  isStreaming?: boolean;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end animate-fade-up">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-surface-raised border border-border px-4 py-2.5 text-[0.92rem] text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-up">
      <div className="mb-1.5 text-[0.68rem] uppercase tracking-[0.12em] text-muted-2">
        Answer
      </div>
      <div className="font-serif text-[1.02rem] leading-[1.7] text-foreground whitespace-pre-wrap">
        {message.content}
        {isStreaming && (
          <span className="animate-caret ml-0.5 inline-block h-[1.05em] w-[2px] translate-y-[2px] bg-accent" />
        )}
      </div>

      {message.citations && message.citations.length > 0 && (
        <div className="mt-4 flex flex-col gap-1.5">
          {message.citations.map((citation) => (
            <CitationChip key={citation.paperId} citation={citation} />
          ))}
        </div>
      )}
    </div>
  );
}
