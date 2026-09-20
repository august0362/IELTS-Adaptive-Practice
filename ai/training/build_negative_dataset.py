"""
Milestone 7 follow-up: balances the 37 raw "negative" (honest-refusal)
pairs recovered from the Kaggle run (ai/kaggle/negative_qa_combined.jsonl
— 16 parsed directly + 21 recovered from extract_json_array's error log,
see AI_TASKS.md and kaggle_generation.py's docstring for why) the exact
same way build_final_dataset.py balanced the original 64 positive pairs:
18/37 (49%) landed on "9. Hệ thống theme" alone (same root cause as
before — that section produces far more chunks than others), so reuses
the already-tested `deduplicate`/`cap_per_heading` from
build_final_dataset.py rather than re-implementing them.

Output is the RAW {source, heading, question, answer} shape (not yet
wrapped into {"messages": [...]} training examples) — kept separate from
the already-approved train_final.jsonl on purpose, so make_negative_review_file.py
can generate a review scoped to ONLY the new material, not re-review the
58 examples the user already approved.

Run from ai/:  python -m training.build_negative_dataset
"""
import json
import random
import sys
from pathlib import Path

from training.build_final_dataset import cap_per_heading, deduplicate

INPUT_PATH = Path(__file__).resolve().parents[1] / "kaggle" / "negative_qa_combined.jsonl"
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "negative_candidates.jsonl"

MAX_PER_HEADING = 4  # same cap as build_final_dataset.py, same reasoning (avoid 1 long/technical section dominating)


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    random.seed(7)  # same seed as build_final_dataset.py, reproducible, not cryptographic

    pairs_raw = [json.loads(line) for line in INPUT_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    random.shuffle(pairs_raw)
    pairs = deduplicate(pairs_raw)
    pairs = cap_per_heading(pairs, MAX_PER_HEADING)

    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        for pair in pairs:
            f.write(json.dumps(pair, ensure_ascii=False) + "\n")

    print(
        f"{len(pairs_raw)} gốc -> {len(pairs)} sau khi bỏ trùng + giới hạn {MAX_PER_HEADING}/mục "
        f"-> {OUTPUT_PATH}"
    )


if __name__ == "__main__":
    main()
