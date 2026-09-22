"""
Builds data/embeddings.json for the Citeline RAG app.

For each paper in data/papers.json:
  1. Download the PDF from arXiv (cached under scripts/.cache/).
  2. Extract text and cut off the bibliography (references add noise, not signal).
  3. Chunk the text by token count with a small overlap.
  4. Embed every chunk with the OpenAI embeddings API.

Reads OPENAI_API_KEY from the repo's .env.local (same file the Next.js app
uses) if it's set there, otherwise from the environment.

Run from the scripts/ directory:
    pip install -r requirements.txt
    python ingest.py
"""

from __future__ import annotations

import json
import os
import re
import sys
from pathlib import Path

import requests
import tiktoken
from dotenv import load_dotenv
from openai import OpenAI
from pypdf import PdfReader
from tqdm import tqdm

SCRIPT_DIR = Path(__file__).parent
ROOT_DIR = SCRIPT_DIR.parent

load_dotenv(ROOT_DIR / ".env.local")
DATA_DIR = ROOT_DIR / "data"
CACHE_DIR = SCRIPT_DIR / ".cache"

PAPERS_PATH = DATA_DIR / "papers.json"
OUTPUT_PATH = DATA_DIR / "embeddings.json"

EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSIONS = 512  # must match lib/openai.ts
CHUNK_TOKENS = 300
CHUNK_OVERLAP_TOKENS = 50
EMBEDDING_BATCH_SIZE = 100

REFERENCES_HEADING = re.compile(
    r"\n\s*(references|bibliography)\s*\n", re.IGNORECASE
)


def download_pdf(arxiv_id: str) -> Path:
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    dest = CACHE_DIR / f"{arxiv_id}.pdf"
    if dest.exists():
        return dest
    url = f"https://arxiv.org/pdf/{arxiv_id}.pdf"
    resp = requests.get(url, timeout=60, headers={"User-Agent": "citeline-ingest/1.0"})
    resp.raise_for_status()
    dest.write_bytes(resp.content)
    return dest


def extract_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    pages = [page.extract_text() or "" for page in reader.pages]
    text = "\n".join(pages)

    match = REFERENCES_HEADING.search(text)
    if match and match.start() > len(text) * 0.4:
        text = text[: match.start()]

    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def chunk_text(text: str, encoding: "tiktoken.Encoding") -> list[str]:
    # disallowed_special=() treats strings like "<|endofprompt|>" as plain
    # text instead of raising. Papers that discuss tokenizers (e.g. the
    # GPT-4 report) legitimately contain these substrings verbatim.
    tokens = encoding.encode(text, disallowed_special=())
    chunks = []
    step = CHUNK_TOKENS - CHUNK_OVERLAP_TOKENS
    for start in range(0, len(tokens), step):
        window = tokens[start : start + CHUNK_TOKENS]
        if len(window) < 40:  # drop tiny trailing scraps
            continue
        chunks.append(encoding.decode(window))
        if start + CHUNK_TOKENS >= len(tokens):
            break
    return chunks


def embed_batch(client: OpenAI, texts: list[str]) -> list[list[float]]:
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts,
        dimensions=EMBEDDING_DIMENSIONS,
    )
    return [item.embedding for item in response.data]


def main() -> None:
    if not os.environ.get("OPENAI_API_KEY"):
        sys.exit(
            "OPENAI_API_KEY is not set. Add it to .env.local at the repo "
            "root (see env.example), or export it before running this script."
        )

    papers = json.loads(PAPERS_PATH.read_text())
    encoding = tiktoken.get_encoding("cl100k_base")
    client = OpenAI()

    all_records: list[dict] = []
    pending_texts: list[str] = []
    pending_meta: list[tuple[str, int]] = []

    def flush():
        if not pending_texts:
            return
        embeddings = embed_batch(client, pending_texts)
        for (paper_id, chunk_index), text, embedding in zip(
            pending_meta, pending_texts, embeddings
        ):
            all_records.append(
                {
                    "paperId": paper_id,
                    "chunkIndex": chunk_index,
                    "text": text,
                    "embedding": embedding,
                }
            )
        pending_texts.clear()
        pending_meta.clear()

    for paper in tqdm(papers, desc="Papers"):
        arxiv_id = paper["id"]
        try:
            pdf_path = download_pdf(arxiv_id)
            text = extract_text(pdf_path)
            chunks = chunk_text(text, encoding)
        except Exception as exc:  # noqa: BLE001 - report and keep going
            print(f"  ! skipped {arxiv_id}: {exc}", file=sys.stderr)
            continue

        for i, chunk in enumerate(chunks):
            pending_texts.append(chunk)
            pending_meta.append((arxiv_id, i))
            if len(pending_texts) >= EMBEDDING_BATCH_SIZE:
                flush()

    flush()

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(all_records))

    print(
        f"\nWrote {len(all_records)} chunks from {len(papers)} papers to "
        f"{OUTPUT_PATH.relative_to(ROOT_DIR)}"
    )


if __name__ == "__main__":
    main()
