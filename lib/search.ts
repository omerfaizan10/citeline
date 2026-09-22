import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { Chunk, Citation } from "./types";
import papers from "@/data/papers.json";

const EMBEDDINGS_PATH = path.join(process.cwd(), "data", "embeddings.json");

let cachedChunks: Chunk[] | null = null;

export class CorpusNotIngestedError extends Error {
  constructor() {
    super(
      "data/embeddings.json is missing. Run the ingestion script first: " +
        "cd scripts && pip install -r requirements.txt && python ingest.py",
    );
    this.name = "CorpusNotIngestedError";
  }
}

function loadChunks(): Chunk[] {
  if (cachedChunks) return cachedChunks;
  if (!fs.existsSync(EMBEDDINGS_PATH)) {
    throw new CorpusNotIngestedError();
  }
  const raw = fs.readFileSync(EMBEDDINGS_PATH, "utf-8");
  cachedChunks = JSON.parse(raw) as Chunk[];
  return cachedChunks;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export type ScoredChunk = Chunk & { score: number };

export function searchChunks(
  queryEmbedding: number[],
  topK = 6,
): ScoredChunk[] {
  const chunks = loadChunks();
  return chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * If a handful of papers dominate the broad top-K (the query is clearly
 * "about" one specific paper rather than a broad cross-corpus question),
 * returns that paper's id. Otherwise null.
 */
export function findDominantPaper(
  chunks: ScoredChunk[],
  minCount: number,
): string | null {
  const counts = new Map<string, number>();
  for (const chunk of chunks) {
    counts.set(chunk.paperId, (counts.get(chunk.paperId) ?? 0) + 1);
  }
  let dominant: string | null = null;
  let dominantCount = 0;
  for (const [paperId, count] of counts) {
    if (count > dominantCount) {
      dominant = paperId;
      dominantCount = count;
    }
  }
  return dominantCount >= minCount ? dominant : null;
}

const DOMINANCE_MIN_COUNT = 3;
const FOCUSED_TOP_K = 14;

/**
 * Broad search first (across the whole corpus). If one paper clearly
 * dominates those results, a question is almost certainly "about" that
 * paper specifically -- in which case a flat top-K spread across the whole
 * corpus badly under-serves it (with 131 similar papers, a paper's own
 * chunks compete against near-duplicates from adjacent papers for a handful
 * of slots). Re-run retrieval scoped to just that paper with a much larger
 * K instead, so detailed questions about one paper actually get enough of
 * it to answer from.
 */
export function adaptiveSearch(
  queryEmbedding: number[],
  broadTopK: number,
): ScoredChunk[] {
  const broad = searchChunks(queryEmbedding, broadTopK);
  const dominant = findDominantPaper(broad, DOMINANCE_MIN_COUNT);
  if (!dominant) return broad;

  const chunks = loadChunks().filter((c) => c.paperId === dominant);
  const focused = chunks
    .map((chunk) => ({
      ...chunk,
      score: cosineSimilarity(queryEmbedding, chunk.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, FOCUSED_TOP_K);

  // The "dominant" paper is a strong guess, not a certainty -- it can lock
  // onto a very close neighbor (RoBERTa instead of BERT, DDIM instead of
  // DDPM). Keep a couple of the next-best *other* papers from the broad
  // pass alongside the deep dive, so a slightly-wrong guess doesn't fully
  // crowd out the paper the question was actually about.
  const alternates = broad.filter((c) => c.paperId !== dominant).slice(0, 2);

  return [...focused, ...alternates].sort((a, b) => b.score - a.score);
}

export function toCitations(chunks: ScoredChunk[]): Citation[] {
  const byPaper = new Map<string, ScoredChunk>();
  for (const chunk of chunks) {
    const existing = byPaper.get(chunk.paperId);
    if (!existing || chunk.score > existing.score) {
      byPaper.set(chunk.paperId, chunk);
    }
  }
  return Array.from(byPaper.values())
    .sort((a, b) => b.score - a.score)
    .map((chunk) => {
      const paper = papers.find((p) => p.id === chunk.paperId);
      return {
        paperId: chunk.paperId,
        title: paper?.title ?? chunk.paperId,
        authors: paper?.authors ?? "",
        year: paper?.year ?? 0,
        snippet:
          chunk.text.slice(0, 220).trim() +
          (chunk.text.length > 220 ? "…" : ""),
        score: Math.round(chunk.score * 1000) / 1000,
      };
    });
}
