import Link from "next/link";
import type { Metadata } from "next";
import papers from "@/data/papers.json";
import CorpusBrowser from "@/components/CorpusBrowser";

export const metadata: Metadata = {
  title: "Corpus: Citeline",
  description: "All papers Citeline can answer questions from.",
};

export default function CorpusPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-[820px] px-6 py-10 md:px-8">
        <Link
          href="/"
          className="text-[0.78rem] text-muted-2 transition-colors hover:text-accent"
        >
          ← Back to Citeline
        </Link>

        <h1 className="mt-4 font-serif text-2xl text-foreground">The corpus</h1>
        <p className="mt-1.5 max-w-lg text-[0.85rem] text-muted">
          Every paper Citeline can answer questions from, and nothing else.
          Click any title to read the paper itself on arXiv.
        </p>

        <div className="mt-8">
          <CorpusBrowser papers={papers} />
        </div>
      </div>
    </div>
  );
}
