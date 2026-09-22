# Citeline

A retrieval-augmented research assistant that answers questions using only a
fixed corpus of 131 machine learning papers — spanning Transformers, LLMs,
computer vision, generative models, RL, graph neural networks, speech,
interpretability, and more — with every answer traceable back to the paper
it came from.

**Live demo:** https://askthepapers.vercel.app

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
2. **Retrieval (runtime, Node)** — the question is embedded _with the last
   couple of conversation turns folded in_ (a bare follow-up like "go into
   more detail" carries almost no topical signal by itself), then compared
   against every chunk with cosine similarity. If one paper clearly
   dominates that first pass, retrieval runs a second time scoped to just
   that paper with a much larger K, so detailed questions about a specific
   paper actually get enough of it to answer from — a couple of runner-up
   papers from the first pass are kept alongside as a hedge, in case that
   "dominant" guess was really a very close neighbor instead of the right
   paper.
3. **Generation** — the top excerpts are handed to `gpt-4o-mini` with a
   system prompt that forbids answering from anything the model already
   knows about these papers — only the retrieved text. The answer streams
   back to the browser token by token.

Every citation chip in the UI shows its cosine-similarity score and expands
to the exact excerpt that was retrieved, so the retrieval step isn't a black
box — you can see precisely what the model was and wasn't given.

## Does the retrieval actually work?

I didn't want to just claim it does. `eval/questions.json` has 30 questions,
each written about a specific paper in the corpus, with that paper's arXiv
id as the expected answer. `scripts/evaluate.py` runs every question against
the real, running app (not a reimplementation of the search logic) and
checks whether the expected paper shows up in the citations.

Current results (regenerate anytime with `python scripts/evaluate.py`, full
breakdown in [`eval/results.md`](eval/results.md)):

- **Top-1 accuracy: 77%** (23/30) — the expected paper was the single
  closest match
- **Top-K accuracy: 90%** (27/30) — the expected paper appeared somewhere
  in the citations shown
- **Average latency: ~2.7s** per question

The three misses are genuinely informative, not bugs: a question about
BERT's masked-language-modeling objective pulled RoBERTa, XLNet, and
ELECTRA instead — all of which legitimately discuss masked pretraining
objectives and are direct BERT-family papers. A DDPM question pulled DDIM
and Improved DDPM, both explicit sequels covering the same forward process.
A word2vec question pulled its own companion paper ("Distributed
Representations of Words and Phrases"), by the same authors, on the same
topic. Growing the corpus to include topically-adjacent papers makes these
"confusable neighbor" cases more likely — that's a real, explainable
property of the system, not something I'm hiding.

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
- **Adaptive retrieval depth, not a fixed top-K.** Early on, a flat top-6
  search across the whole corpus quietly broke on two kinds of questions:
  follow-ups (embedding "go into more detail" alone carries no topic
  signal — the previous turns have to be folded in) and detailed questions
  about one specific paper (its own chunks were competing against 130
  similar papers for a handful of slots, so the model correctly said the
  excerpts weren't enough — technically honest, but not useful). Fixed by
  detecting when a paper dominates the first-pass results and re-running
  retrieval scoped to just that paper with a larger K. Verified with
  before/after runs of the eval harness that this doesn't regress the
  broad, cross-paper questions (steady at 77%/90%) while fixing the actual
  reported failures.
- **In-memory rate limiting instead of Redis.** `/api/ask` is capped at 40
  requests per 10 minutes per IP, tracked in a plain `Map`. That map isn't
  shared across serverless instances and resets on cold starts, so it's not
  a bulletproof defense against a determined, distributed attacker — but it
  stops casual abuse and accidental loops with zero extra infrastructure.
  A real production deployment would move this to Upstash/Vercel KV for a
  single shared counter. A hard monthly spending cap on the OpenAI account
  itself (Settings → Limits) is the actual backstop against a determined
  attacker getting past this.
- **Structured logs instead of a metrics database.** Every request logs a
  single JSON line (question length, cited papers, top match score,
  latency) that shows up in Vercel's function log viewer — enough to see
  what people are asking and whether retrieval is finding anything, without
  standing up a database for a portfolio project's traffic level.

## Stack

Next.js 16 (App Router, TypeScript) · Tailwind CSS v4 · OpenAI API
(`gpt-4o-mini` + `text-embedding-3-small`) · Python ingestion and evaluation
pipeline (`pypdf`, `tiktoken`) · Vitest for unit tests, GitHub Actions for CI
— deployed on Vercel.

## Testing

```bash
npm test    # unit tests for the retrieval and rate-limiting logic
npm run lint
npm run build
```

All three run on every push via GitHub Actions
(`.github/workflows/ci.yml`).

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

## Running the evaluation

```bash
npm run dev                       # in one terminal
python scripts/evaluate.py        # in another — defaults to localhost:3000
python scripts/evaluate.py --base-url https://askthepapers.vercel.app
```

Writes `eval/results.md` (human-readable) and `eval/results.json`
(machine-readable).

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
