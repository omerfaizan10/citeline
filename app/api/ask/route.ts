import { NextRequest } from "next/server";
import {
  getOpenAIClient,
  CHAT_MODEL,
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
} from "@/lib/openai";
import {
  searchChunks,
  toCitations,
  CorpusNotIngestedError,
} from "@/lib/search";
import { checkRateLimit, getClientKey } from "@/lib/rateLimit";
import type { ChatMessage } from "@/lib/types";

export const runtime = "nodejs";

const MAX_QUESTION_LENGTH = 800;
const MAX_HISTORY_TURNS = 4;

// Structured, single-line JSON logs so they're greppable in Vercel's
// function log viewer (Project -> Logs) without any extra infrastructure.
// A future iteration could pipe these into Upstash/Vercel KV for a live
// /stats dashboard instead of reading them off the log tail by hand.
function logRequest(entry: Record<string, unknown>) {
  console.log(JSON.stringify({ event: "ask_request", ...entry }));
}

const SYSTEM_PROMPT = `You are Citeline, a research assistant that answers questions strictly using the excerpts provided below, drawn from a fixed corpus of machine learning papers.

Rules:
- Answer only from the excerpts. Do not use outside knowledge, even if you recognize the paper.
- If the excerpts don't contain enough information to answer, say so plainly instead of guessing.
- Write like a knowledgeable colleague explaining a paper, not like a search engine: clear, precise, no filler, no bullet-point-only answers unless the question calls for a list.
- Do not invent citation markers like [1] in your prose — the sources are shown separately in the UI. Just refer to papers by name when useful.
- Keep answers focused. A few tight paragraphs beats an exhaustive essay.
- The UI renders plain text only, not LaTeX or Markdown. Never use LaTeX
  notation (no \\[, \\text{}, \\cdot, etc.) or Markdown formatting. Describe
  equations in plain words or simple inline notation instead, e.g. "the
  output is the softmax of QK^T divided by the square root of d_k, times V".`;

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const clientKey = getClientKey(req.headers);

  const rateLimit = checkRateLimit(clientKey);
  if (!rateLimit.allowed) {
    logRequest({ clientKey, outcome: "rate_limited" });
    return Response.json(
      { error: "Too many requests. Please wait a bit before asking again." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  let body: { question?: string; history?: ChatMessage[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const question = (body.question ?? "").trim();
  if (!question) {
    return Response.json({ error: "Question is required." }, { status: 400 });
  }
  if (question.length > MAX_QUESTION_LENGTH) {
    return Response.json(
      { error: `Question must be under ${MAX_QUESTION_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const history = (body.history ?? []).slice(-MAX_HISTORY_TURNS);

  try {
    const openai = getOpenAIClient();

    const embeddingResponse = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: question,
      dimensions: EMBEDDING_DIMENSIONS,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;

    const matches = searchChunks(queryEmbedding, 6);
    const citations = toCitations(matches).slice(0, 5);

    const context = matches
      .map((chunk, i) => `[Excerpt ${i + 1} — ${chunk.paperId}]\n${chunk.text}`)
      .join("\n\n");

    const messages: {
      role: "system" | "user" | "assistant";
      content: string;
    }[] = [
      { role: "system", content: SYSTEM_PROMPT },
      ...history.map((turn) => ({ role: turn.role, content: turn.content })),
      {
        role: "user",
        content: `Excerpts:\n\n${context}\n\nQuestion: ${question}`,
      },
    ];

    const completion = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      stream: true,
      temperature: 0.2,
    });

    const encoder = new TextEncoder();
    let answerLength = 0;
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of completion) {
            const delta = chunk.choices[0]?.delta?.content;
            if (delta) {
              controller.enqueue(encoder.encode(delta));
              answerLength += delta.length;
            }
          }
        } catch (err) {
          logRequest({
            clientKey,
            outcome: "stream_error",
            latencyMs: Date.now() - startedAt,
          });
          controller.error(err);
          return;
        }
        controller.close();
        logRequest({
          clientKey,
          outcome: "ok",
          questionLength: question.length,
          citedPapers: citations.map((c) => c.paperId),
          topScore: citations[0]?.score ?? null,
          answerLength,
          latencyMs: Date.now() - startedAt,
        });
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Citations": encodeURIComponent(JSON.stringify(citations)),
      },
    });
  } catch (err) {
    logRequest({
      clientKey,
      outcome: "error",
      latencyMs: Date.now() - startedAt,
    });
    if (err instanceof CorpusNotIngestedError) {
      return Response.json({ error: err.message }, { status: 503 });
    }
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error.";
    return Response.json({ error: message }, { status: 500 });
  }
}
