# Citeline

A retrieval-augmented research assistant that answers questions using only a
fixed corpus of 131 machine learning papers — spanning Transformers, LLMs,
computer vision, generative models, RL, graph neural networks, speech,
interpretability, and more — with every answer traceable back to the paper
it came from.

**Live demo:** _add your Vercel URL here once deployed_

## Why I built this

Most RAG demos are a thin wrapper around an API call. I wanted to build the
retrieval layer myself and understand every piece of it: how the corpus is
chunked, why the model shouldn't be allowed to answer from anything but the
retrieved excerpts, and what should happen when the answer genuinely isn't
in the corpus.

## How it works

1. **Ingestion (offline, Python)** — `scripts/ingest.py` downloads each
   paper's PDF from arXiv, strips the bibliography (it's noise for
   retrieval, not signal), splits the remaining text into ~300-token
   chunks with a 50-token overlap, and embeds every chunk with OpenAI's
   `text-embedding-3-small`, shortened to 512 dimensions via the API's
   `dimensions` parameter — a size/quality trade-off that keeps the
   resulting `data/embeddings.json` small enough to ship in the repo.
2. **Retrieval (runtime, Node)** — a question is embedded the same way,
   compared against every chunk with cosine similarity, and the top
   matches are deduplicated down to their source papers.
3. **Generation** — the top excerpts are handed to `gpt-4o-mini` with a
   system prompt that forbids answering from anything the model already
   knows about these papers — only the retrieved text. The answer streams
   back to the browser token by token.

## A few design decisions

- **In-memory vector search instead of Pinecone/Chroma.** The corpus is
  static (131 papers, ~7,600 chunks), so a linear cosine-similarity scan
  over a JSON file runs in a few milliseconds and needs no external
  database, no hosting cost, and no extra moving part to keep alive.
  The real ceiling on this approach isn't query speed — it's the size of
  `data/embeddings.json` itself, since it has to ship inside the deployed
  function. GitHub rejects any single file over 100MB, and Vercel caps an
  uncompressed serverless function at 250MB; at 512-dim embeddings this
  corpus sits around 80MB, which is close to as far as this architecture
  can go. Past that, or for a corpus that changes at runtime, I'd move to
  pgvector or Pinecone instead.
- **Citations come from retrieval, not from the model.** The model never
  emits `[1]`-style citation markers — those are notoriously easy for LLMs
  to get wrong (right marker, wrong paper). The citation chips under each
  answer are built directly from the chunks retrieval actually used, so
  they're accurate by construction.
- **The corpus is fixed on purpose.** This is meant to be a working RAG
  pipeline I can reason about completely end to end, not a general-purpose
  paper search engine.

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
immediately — no need to run the ingestion pipeline just to try it.

## Rebuilding the corpus

Only needed if you change `data/papers.json` (swap in different papers) or
want to re-chunk/re-embed:

```bash
cd scripts
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python ingest.py   # reads OPENAI_API_KEY from ../.env.local
```

This writes a fresh `data/embeddings.json`. Cost for the default 131-paper
corpus is well under a dollar.

## Deploying

Push to GitHub, then import the repo in Vercel. Add `OPENAI_API_KEY` as an
environment variable in the Vercel project settings — no other
configuration is needed.

## Limitations / what's next

- No conversation memory beyond the last few turns — long follow-up chains
  can lose earlier context.
- The bibliography-stripping heuristic in `ingest.py` is a regex looking
  for a "References" heading past 40% of the document; it's right most of
  the time but not verified per paper.
- At a larger corpus size, retrieval should move to a real vector database
  with re-ranking rather than cosine similarity alone.
