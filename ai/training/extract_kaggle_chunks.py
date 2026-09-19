"""
Filters ai/data/processed/doc_index.json (Milestone 6's full RAG index — every
chunk of PROJECT_CONTEXT.md/USER_GUIDE.md/document.txt, dev-facing sections
included) down to just the *user-facing* chunks the Kaggle notebook should
generate Q&A from, and strips the embedding vectors (irrelevant to Qwen3.5-9B
generation, and 4x the file size).

Reuses generate_template_data.py's own heading allow-list as the single
source of truth — a real gap found via a live smoke test on Kaggle, not
hypothetical: without this filter, the first run generated a Q&A pair from
PROJECT_CONTEXT.md's own meta-preamble ("File này để làm gì... PHẢI được cập
nhật vào file này ngay trong cùng bước/commit...") — a question about how to
maintain the documentation itself, which no real IELTS-studying user would
ever ask Navita. Both generation paths (template + Kaggle model) must draw
from the same curated, user-relevant section list, or they drift apart
exactly like this.

Run from ai/:  python -m training.extract_kaggle_chunks
"""
import json
from pathlib import Path

from training.generate_template_data import PROJECT_CONTEXT_QUESTIONS, USER_GUIDE_QUESTIONS

INDEX_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "doc_index.json"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "doc_chunks_for_kaggle.json"

ALLOWED_HEADINGS = list(PROJECT_CONTEXT_QUESTIONS.keys()) + list(USER_GUIDE_QUESTIONS.keys())
ALLOWED_SOURCES = {"PROJECT_CONTEXT.md", "USER_GUIDE.md"}  # document.txt is a dev build-history log, never included


def is_allowed(chunk: dict) -> bool:
    if chunk["source"] not in ALLOWED_SOURCES:
        return False
    return any(key in chunk["heading"] for key in ALLOWED_HEADINGS)


def main() -> None:
    all_chunks = json.loads(INDEX_PATH.read_text(encoding="utf-8"))
    filtered = [
        {"source": c["source"], "heading": c["heading"], "text": c["text"]} for c in all_chunks if is_allowed(c)
    ]

    OUTPUT_PATH.write_text(json.dumps(filtered, ensure_ascii=False), encoding="utf-8")
    print(f"{len(filtered)}/{len(all_chunks)} chunks kept (user-facing sections only) -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
