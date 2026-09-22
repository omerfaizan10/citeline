# Citeline

A retrieval-augmented research assistant that answers questions using only a
fixed corpus of 17 foundational machine learning papers — Transformers,
BERT, GPT-3, ResNet, diffusion models, LoRA, RAG itself, and others — with
every answer traceable back to the paper it came from.

**Live demo:** _add your Vercel URL here once deployed_

## Why this exists

Most beginner RAG demos wrap an API call and call it a day. The point of
this project was to build the retrieval layer myself and be able to defend
every decision in it: how the corpus is chunked, why the model isn't
allowed to answer from anything but the retrieved excerpts, and what
happens when the answer genuinely isn't in the corpus.

## How it works

1. **Ingestion (offline, Python)** — `scripts/ingest.py` downloads each
   paper's PDF from arXiv, strips the bibliography (it's noise for
   retrieval, not signal), splits the remaining text into ~300-token
   chunks with a 50-token overlap, and embeds every chunk with OpenAI's
   `text-embedding-3-small`, shortened to 512 dimensions via the API's
   `dimensions` parameter — a deliberate size/quality trade-off that keeps
   the resulting `data/embeddings.json` small enough to ship in the repo.
2. **Retrieval (runtime, Node)** — a question is embedded the same way,
   compared against every chunk with cosine similarity, and the top
   matches are deduplicated down to their source papers.
3. **Generation** — the top excerpts are handed to `gpt-4o-mini` with a
   system prompt that explicitly forbids answering from anything the model
   already knows about these papers — only the retrieved text. The answer
   streams back to the browser token by token.

## Architecture decisions worth knowing (and defending in an interview)

- **In-memory vector search instead of Pinecone/Chroma.** The corpus is
  small and static (17 papers, ~1,000 chunks), so a linear cosine-similarity
  scan over a JSON file runs in a few milliseconds and needs no external
  database, no hosting cost, and no extra moving part to keep alive. This
  stops being the right call well before 100k+ chunks or frequently
  changing data — at that point I'd reach for pgvector or Pinecone instead.
- **Citations come from retrieval, not from the model.** The model never
  emits `[1]`-style citation markers — those are notoriously easy for LLMs
  to get wrong (right marker, wrong paper). Instead, the citation chips
  under each answer are built directly from the chunks retrieval actually
  used, so they're always accurate by construction.
- **The corpus is fixed on purpose.** This is a portfolio piece meant to
  demonstrate a working RAG pipeline end to end, not a general-purpose
  paper search engine — the scope is intentionally small enough to reason
  about completely.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · OpenAI API
(`gpt-4o-mini` + `text-embedding-3-small`) · Python ingestion pipeline
(`pypdf`, `tiktoken`) — deployed on Vercel.

## Running it locally

```bash
npm install
cp env.example .env.local   # add your OPENAI_API_KEY
npm run dev
```

`data/embeddings.json` is committed to the repo, so the app works
immediately — you don't need to run the ingestion pipeline just to try it.

## Rebuilding the corpus

Only needed if you change `data/papers.json` (swap in your own papers) or
want to re-chunk/re-embed:

```bash
cd scripts
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
export OPENAI_API_KEY=sk-...
python ingest.py
```

This writes a fresh `data/embeddings.json`. Cost for the default 17-paper
corpus is a few cents.

## Deploying

Push to GitHub, then import the repo in Vercel. Add `OPENAI_API_KEY` as an
environment variable in the Vercel project settings — no other
configuration is needed.

## Limitations / what I'd do next

- No conversation memory beyond the last few turns — long follow-up chains
  can lose earlier context.
- The bibliography-stripping heuristic in `ingest.py` is a regex looking
  for a "References" heading past 40% of the document; it's right most of
  the time but not verified per-paper.
- At a larger corpus size I'd move retrieval to a real vector database and
  add re-ranking rather than relying on cosine similarity alone.
