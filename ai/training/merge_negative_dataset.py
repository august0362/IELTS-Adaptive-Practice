"""
Milestone 7 follow-up: merges the 23 user-approved "negative" (honest-
refusal) examples (data/processed/negative_candidates.jsonl, approved in
full via negative_review_sample.md — "Đồng ý hết") into the existing,
already-approved train_final.jsonl (58 examples from Step 1/2 — template +
Kaggle-generated). Wraps each pair the same way build_final_dataset.py's
to_training_example() does (reused, not re-implemented) so both example
"kinds" (real-answer and honest-refusal) share the exact same
{"messages": [system, user, assistant]} shape the LoRA notebook expects.

Does NOT re-run build_final_dataset.py's own dedup/cap — that already ran
once (against the original 64 raw Kaggle pairs) and its 58-example output
is the already-approved baseline this script only appends to.

Run from ai/:  python -m training.merge_negative_dataset
"""
import json
import random
import sys
from pathlib import Path

from training.build_final_dataset import to_training_example

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "processed"
TRAIN_FINAL_PATH = DATA_DIR / "train_final.jsonl"
NEGATIVE_CANDIDATES_PATH = DATA_DIR / "negative_candidates.jsonl"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    existing = [json.loads(line) for line in TRAIN_FINAL_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    negative_pairs = [json.loads(line) for line in NEGATIVE_CANDIDATES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    negative_examples = [to_training_example(p["question"], p["answer"]) for p in negative_pairs]

    combined = existing + negative_examples
    random.seed(7)  # reproducible, matches the seed used to build train_final.jsonl originally
    random.shuffle(combined)

    with TRAIN_FINAL_PATH.open("w", encoding="utf-8") as f:
        for example in combined:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")

    print(
        f"{len(existing)} mẫu đã duyệt trước + {len(negative_examples)} mẫu \"từ chối trung thực\" mới "
        f"= {len(combined)} tổng -> {TRAIN_FINAL_PATH}"
    )


if __name__ == "__main__":
    main()
