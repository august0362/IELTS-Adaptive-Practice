"""
Milestone 7 follow-up (user request, 2026-09-20): pads train_final.jsonl
from 81 to 82 examples so the train split (after split_train_eval) comes
out even, for clean 2-GPU data-parallel training (each optimizer step
splits the effective batch evenly across 2 GPUs).

Does NOT invent new content — duplicates one already-approved "honest
refusal" example (picked from negative_candidates.jsonl, itself approved
in full via negative_review_sample.md — "Đồng ý hết"). Duplicating
already-reviewed content isn't new, unreviewed training data; it's exactly
the standard ML technique of oversampling one example, and this happens to
be the exact behavior (honest refusal) Milestone 7's follow-up round exists
to reinforce, so duplicating one of those specifically is a reasonable
pick, not an arbitrary one.

Run from ai/:  python -m training.pad_dataset_for_parallel
"""
import json
import shutil
import sys
from pathlib import Path

from training.build_final_dataset import to_training_example

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "processed"
TRAIN_FINAL_PATH = DATA_DIR / "train_final.jsonl"
NEGATIVE_CANDIDATES_PATH = DATA_DIR / "negative_candidates.jsonl"
BACKUP_PATH = DATA_DIR / "train_final.81.jsonl.bak"


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    examples = [json.loads(line) for line in TRAIN_FINAL_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    if len(examples) % 2 == 0:
        print(f"{TRAIN_FINAL_PATH} đã có {len(examples)} mẫu (chẵn) — không cần thêm gì.")
        return

    negative_pairs = [json.loads(line) for line in NEGATIVE_CANDIDATES_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]
    pick = negative_pairs[0]
    duplicate = to_training_example(pick["question"], pick["answer"])

    shutil.copyfile(TRAIN_FINAL_PATH, BACKUP_PATH)
    examples.append(duplicate)

    with TRAIN_FINAL_PATH.open("w", encoding="utf-8") as f:
        for example in examples:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")

    print(f"Đã nhân đôi 1 mẫu \"từ chối trung thực\" (câu hỏi: {pick['question'][:60]}...)")
    print(f"{len(examples) - 1} -> {len(examples)} mẫu (chẵn) -> {TRAIN_FINAL_PATH}")
    print(f"Bản trước khi thêm đã backup ở {BACKUP_PATH}")


if __name__ == "__main__":
    main()
