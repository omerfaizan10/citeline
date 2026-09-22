import Link from "next/link";
import type { Paper } from "@/lib/types";
import { groupByTopic } from "@/lib/papers";

export default function PaperSidebar({
  papers,
  onLinkClick,
}: {
  papers: Paper[];
  onLinkClick?: () => void;
}) {
  const groups = groupByTopic(papers);

  return (
    <div className="flex h-full flex-col">
      <div className="px-6 pt-7 pb-5">
        <h1 className="font-serif text-[1.35rem] leading-none tracking-tight text-foreground">
          Citeline
        </h1>
        <p className="mt-2 text-xs uppercase tracking-[0.14em] text-muted-2">
          Ask the papers
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-[0.7rem] uppercase tracking-[0.12em] text-muted-2">
            Corpus &middot; {papers.length} papers
          </p>
          <Link
            href="/corpus"
            className="text-[0.68rem] text-muted-2 transition-colors hover:text-accent"
          >
            Browse all →
          </Link>
        </div>
        <div className="space-y-6">
          {groups.map(([topic, items]) => (
            <div key={topic}>
              <h2 className="mb-2 text-[0.7rem] font-medium uppercase tracking-[0.1em] text-muted">
                {topic}
              </h2>
              <ul className="space-y-2.5 border-l border-border">
                {items.map((paper) => (
                  <li key={paper.id} className="pl-3">
                    <a
                      href={`https://arxiv.org/abs/${paper.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={onLinkClick}
                      className="group block"
                    >
                      <span className="block text-[0.83rem] leading-snug text-foreground/90 transition-colors group-hover:text-accent">
                        {paper.title}
                      </span>
                      <span className="mt-0.5 block text-[0.72rem] text-muted-2">
                        {paper.authors} &middot; {paper.year}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-border px-6 py-5">
        <details className="group">
          <summary className="cursor-pointer list-none text-[0.72rem] uppercase tracking-[0.1em] text-muted-2 transition-colors hover:text-foreground">
            How this works
          </summary>
          <p className="mt-2.5 text-[0.78rem] leading-relaxed text-muted">
            Each paper is chunked and embedded ahead of time. A question is
            embedded the same way, matched against those chunks by cosine
            similarity, and only the closest excerpts are sent to the model as
            context — so answers are grounded in the corpus rather than the
            model&apos;s general knowledge.
          </p>
        </details>
        <p className="mt-4 text-[0.68rem] text-muted-2">
          <Link
            href="/stats"
            className="text-muted transition-colors hover:text-accent"
          >
            Usage stats
          </Link>
        </p>
        <p className="mt-1.5 text-[0.68rem] text-muted-2">
          Built by{" "}
          <a
            href="https://github.com/omerfaizan10"
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted transition-colors hover:text-accent"
          >
            Omer Faizan
          </a>
        </p>
      </div>
    </div>
  );
}
