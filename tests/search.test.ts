import { describe, it, expect } from "vitest";
import {
  cosineSimilarity,
  toCitations,
  findDominantPaper,
  type ScoredChunk,
} from "@/lib/search";

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0, 10);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1, 10);
  });

  it("is unaffected by vector magnitude, only direction", () => {
    const a = [3, 4];
    const b = [30, 40]; // same direction, 10x magnitude
    expect(cosineSimilarity(a, b)).toBeCloseTo(1, 10);
  });
});

function makeChunk(overrides: Partial<ScoredChunk>): ScoredChunk {
  return {
    paperId: "1706.03762",
    chunkIndex: 0,
    text: "some excerpt text about attention mechanisms and transformers",
    embedding: [],
    score: 0.5,
    ...overrides,
  };
}

describe("toCitations", () => {
  it("deduplicates multiple chunks from the same paper, keeping the highest score", () => {
    const chunks: ScoredChunk[] = [
      makeChunk({ paperId: "1706.03762", chunkIndex: 0, score: 0.7 }),
      makeChunk({ paperId: "1706.03762", chunkIndex: 5, score: 0.9 }),
    ];
    const citations = toCitations(chunks);
    expect(citations).toHaveLength(1);
    expect(citations[0].score).toBe(0.9);
  });

  it("sorts citations by score descending", () => {
    const chunks: ScoredChunk[] = [
      makeChunk({ paperId: "1810.04805", score: 0.4 }),
      makeChunk({ paperId: "1706.03762", score: 0.9 }),
      makeChunk({ paperId: "2005.14165", score: 0.6 }),
    ];
    const citations = toCitations(chunks);
    expect(citations.map((c) => c.paperId)).toEqual([
      "1706.03762",
      "2005.14165",
      "1810.04805",
    ]);
  });

  it("falls back to the raw arXiv id when a paper isn't in the metadata list", () => {
    const chunks: ScoredChunk[] = [makeChunk({ paperId: "9999.99999" })];
    const citations = toCitations(chunks);
    expect(citations[0].title).toBe("9999.99999");
    expect(citations[0].year).toBe(0);
  });

  it("truncates long snippets with an ellipsis and leaves short ones untouched", () => {
    const short = makeChunk({ text: "short excerpt" });
    const long = makeChunk({ text: "x".repeat(300) });
    const citations = toCitations([short]);
    expect(citations[0].snippet).toBe("short excerpt");

    const longCitations = toCitations([long]);
    expect(longCitations[0].snippet.endsWith("…")).toBe(true);
    expect(longCitations[0].snippet.length).toBe(221); // 220 chars + ellipsis
  });

  it("rounds scores to 3 decimal places", () => {
    const chunks: ScoredChunk[] = [makeChunk({ score: 0.123456789 })];
    expect(toCitations(chunks)[0].score).toBe(0.123);
  });
});

describe("findDominantPaper", () => {
  it("returns the paper id when it meets the minimum count", () => {
    const chunks: ScoredChunk[] = [
      makeChunk({ paperId: "1706.03762" }),
      makeChunk({ paperId: "1706.03762" }),
      makeChunk({ paperId: "1706.03762" }),
      makeChunk({ paperId: "1810.04805" }),
    ];
    expect(findDominantPaper(chunks, 3)).toBe("1706.03762");
  });

  it("returns null when no paper reaches the minimum count", () => {
    const chunks: ScoredChunk[] = [
      makeChunk({ paperId: "1706.03762" }),
      makeChunk({ paperId: "1706.03762" }),
      makeChunk({ paperId: "1810.04805" }),
      makeChunk({ paperId: "2005.14165" }),
    ];
    expect(findDominantPaper(chunks, 3)).toBeNull();
  });

  it("returns null for an empty list", () => {
    expect(findDominantPaper([], 1)).toBeNull();
  });

  it("picks the strict majority when counts are tied at the threshold", () => {
    const chunks: ScoredChunk[] = [
      makeChunk({ paperId: "A" }),
      makeChunk({ paperId: "A" }),
      makeChunk({ paperId: "B" }),
      makeChunk({ paperId: "B" }),
    ];
    // Neither reaches minCount=3, so still null even though it's a tie.
    expect(findDominantPaper(chunks, 3)).toBeNull();
  });
});
