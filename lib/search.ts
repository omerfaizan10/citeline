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
