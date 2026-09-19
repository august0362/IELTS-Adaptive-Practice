"""
Combines Milestone 7's 2 data sources into 1 final training set:
  - ai/data/processed/train_template.jsonl (Step 1, already in {"messages":[...]} format)
  - ai/kaggle/generated_qa.jsonl (Step 2, raw {source, heading, question, answer})

Real imbalance found by actually looking at the Kaggle output (not assumed):
30 of 64 generated pairs (47%) were all about section 9 "Hệ thống theme" —
that section is long/technical (color-role computation, React hook details),
so it produced far more *chunks* than other sections, and each chunk still
passed heading-level filtering (extract_kaggle_chunks.py) since the heading
itself is legitimately user-facing ("có bao nhiêu bảng màu") even though a
lot of the section's actual prose is developer-facing minutiae. Capping the
count per heading fixes the statistical skew without rewriting/authoring any
answer text — pure selection among what the model already generated, which
is a different thing from what section 6 of AI_CHATBOT_PLAN.md rules out.

Run from ai/:  python -m training.build_final_dataset
"""
import json
import random
import sys
from difflib import SequenceMatcher
from pathlib import Path

from server.prompt import SYSTEM_INSTRUCTION

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "processed"
KAGGLE_OUTPUT_PATH = Path(__file__).resolve().parents[1] / "kaggle" / "generated_qa.jsonl"
TEMPLATE_PATH = DATA_DIR / "train_template.jsonl"
OUTPUT_PATH = DATA_DIR / "train_final.jsonl"

MAX_PER_HEADING = 4
NEAR_DUPLICATE_THRESHOLD = 0.85


def similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a.strip().lower(), b.strip().lower()).ratio()


def deduplicate(pairs: list[dict]) -> list[dict]:
    """Greedy: keeps a pair unless its question is a near-duplicate of one
    already kept. Order-preserving, so callers control what "first" means
    (e.g. shuffle before calling for a random representative kept)."""
    kept: list[dict] = []
    for pair in pairs:
        if any(similarity(pair["question"], k["question"]) >= NEAR_DUPLICATE_THRESHOLD for k in kept):
            continue
        kept.append(pair)
    return kept


def cap_per_heading(pairs: list[dict], max_per_heading: int) -> list[dict]:
    """Keeps at most `max_per_heading` pairs per (source, heading) — fixes a
    section that produced disproportionately many chunks (and therefore
    pairs) from dominating the final dataset. Order-preserving within each
    heading's own kept subset."""
    counts: dict[tuple[str, str], int] = {}
    kept = []
    for pair in pairs:
        key = (pair["source"], pair["heading"])
        counts.setdefault(key, 0)
        if counts[key] < max_per_heading:
            kept.append(pair)
            counts[key] += 1
    return kept


def to_training_example(question: str, answer: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


def main() -> None:
    # Windows' terminal default codepage (cp1258/cp1252) can't encode all the
    # Vietnamese diacritics in the summary line below — force UTF-8 for this
    # process's stdout rather than let a print() crash after the real work
    # (writing OUTPUT_PATH, always opened with encoding="utf-8" explicitly)
    # already succeeded.
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    random.seed(7)  # reproducible shuffling, not for cryptographic purposes

    kaggle_pairs_raw = [json.loads(line) for line in KAGGLE_OUTPUT_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    random.shuffle(kaggle_pairs_raw)  # shuffle before dedup/cap so which near-duplicate "wins" isn't just generation order
    kaggle_pairs = deduplicate(kaggle_pairs_raw)
    kaggle_pairs = cap_per_heading(kaggle_pairs, MAX_PER_HEADING)
    kaggle_examples = [to_training_example(p["question"], p["answer"]) for p in kaggle_pairs]

    template_examples = [json.loads(line) for line in TEMPLATE_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]

    final = template_examples + kaggle_examples
    random.shuffle(final)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        for example in final:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")

    print(
        f"{len(template_examples)} template + {len(kaggle_examples)} model-generated "
        f"(sau khi bỏ trùng + giới hạn {MAX_PER_HEADING}/mục, từ {len(kaggle_pairs_raw)} gốc) "
        f"= {len(final)} tổng -> {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
