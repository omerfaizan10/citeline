"""
Retrieval evaluation harness for Citeline.

Runs a fixed set of questions (eval/questions.json) against a running
instance of the app, checks whether the paper the question was written
about actually shows up in the model's citations, and writes a report to
eval/results.md.

This tests the real, deployed pipeline end to end -- embedding, retrieval,
and the API route -- not a reimplementation of the search logic.

Usage:
    python evaluate.py                          # against http://localhost:3000
    python evaluate.py --base-url https://askthepapers.vercel.app
"""

from __future__ import annotations

import argparse
import json
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).parent.parent
QUESTIONS_PATH = ROOT_DIR / "eval" / "questions.json"
RESULTS_MD_PATH = ROOT_DIR / "eval" / "results.md"
RESULTS_JSON_PATH = ROOT_DIR / "eval" / "results.json"


def ask(base_url: str, question: str) -> tuple[list[str], float, str]:
    """Returns (cited_paper_ids, latency_seconds, answer_text)."""
    req = urllib.request.Request(
        f"{base_url}/api/ask",
        data=json.dumps({"question": question}).encode(),
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    started = time.monotonic()
    with urllib.request.urlopen(req, timeout=60) as resp:
        citations_header = resp.headers.get("X-Citations")
        answer = resp.read().decode()
    latency = time.monotonic() - started

    citations = (
        json.loads(urllib.parse.unquote(citations_header)) if citations_header else []
    )
    return [c["paperId"] for c in citations], latency, answer


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--base-url", default="http://localhost:3000")
    args = parser.parse_args()

    questions = json.loads(QUESTIONS_PATH.read_text())
    results = []

    for i, item in enumerate(questions, 1):
        question = item["question"]
        expected = item["expectedPaperId"]
        print(f"[{i}/{len(questions)}] {question}")

        try:
            cited, latency, answer = ask(args.base_url, question)
            error = None
        except Exception as exc:  # noqa: BLE001
            cited, latency, answer, error = [], 0.0, "", str(exc)

        hit_top1 = bool(cited) and cited[0] == expected
        hit_topk = expected in cited

        results.append(
            {
                "question": question,
                "expectedPaperId": expected,
                "citedPaperIds": cited,
                "hitTop1": hit_top1,
                "hitTopK": hit_topk,
                "latencySeconds": round(latency, 2),
                "answerPreview": answer[:150],
                "error": error,
            }
        )
        status = "TOP-1" if hit_top1 else ("TOP-K" if hit_topk else "MISS")
        print(f"    -> {status} ({latency:.1f}s)")

    n = len(results)
    top1_count = sum(r["hitTop1"] for r in results)
    topk_count = sum(r["hitTopK"] for r in results)
    avg_latency = sum(r["latencySeconds"] for r in results) / n if n else 0
    errors = [r for r in results if r["error"]]

    summary = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "baseUrl": args.base_url,
        "totalQuestions": n,
        "top1Accuracy": round(top1_count / n, 3) if n else 0,
        "topKAccuracy": round(topk_count / n, 3) if n else 0,
        "avgLatencySeconds": round(avg_latency, 2),
        "errorCount": len(errors),
        "results": results,
    }
    RESULTS_JSON_PATH.write_text(json.dumps(summary, indent=2))

    lines = [
        "# Citeline retrieval evaluation",
        "",
        f"Run against `{args.base_url}` on {summary['generatedAt']}.",
        "",
        f"- **Top-1 accuracy:** {top1_count}/{n} ({summary['top1Accuracy']:.0%}) "
        "-- the expected paper was the single closest match",
        f"- **Top-K accuracy:** {topk_count}/{n} ({summary['topKAccuracy']:.0%}) "
        "-- the expected paper appeared anywhere in the citations shown",
        f"- **Average latency:** {avg_latency:.1f}s per question",
        f"- **Errors:** {len(errors)}",
        "",
        "| # | Question | Expected | Result | Latency |",
        "|---|----------|----------|--------|---------|",
    ]
    for i, r in enumerate(results, 1):
        status = "✅ top-1" if r["hitTop1"] else ("🟡 top-k" if r["hitTopK"] else "❌ miss")
        if r["error"]:
            status = "⚠️ error"
        q = r["question"][:70] + ("…" if len(r["question"]) > 70 else "")
        lines.append(
            f"| {i} | {q} | `{r['expectedPaperId']}` | {status} | "
            f"{r['latencySeconds']:.1f}s |"
        )

    misses = [r for r in results if not r["hitTopK"] and not r["error"]]
    if misses:
        lines += ["", "## Misses", ""]
        for r in misses:
            lines.append(
                f"- **{r['question']}** -- expected `{r['expectedPaperId']}`, "
                f"got {r['citedPaperIds']}"
            )

    RESULTS_MD_PATH.write_text("\n".join(lines) + "\n")

    print(
        f"\nTop-1: {top1_count}/{n} ({summary['top1Accuracy']:.0%})  "
        f"Top-K: {topk_count}/{n} ({summary['topKAccuracy']:.0%})  "
        f"avg latency: {avg_latency:.1f}s"
    )
    print(f"Wrote {RESULTS_MD_PATH.relative_to(ROOT_DIR)}")


if __name__ == "__main__":
    main()
