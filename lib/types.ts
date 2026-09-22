export type Paper = {
  id: string; // arXiv id, e.g. "1706.03762"
  title: string;
  authors: string;
  year: number;
  topic: string;
};

export type Chunk = {
  paperId: string;
  chunkIndex: number;
  text: string;
  embedding: number[];
};

export type Citation = {
  paperId: string;
  title: string;
  authors: string;
  year: number;
  snippet: string;
};

export type ChatMessage = {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
};

export type AskResponse = {
  answer: string;
  citations: Citation[];
};
