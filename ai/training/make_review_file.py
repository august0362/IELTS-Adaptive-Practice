"""
Milestone 7 step 5 (AI_CHATBOT_PLAN.md section 12.2): writes a human-readable
review file for the user to approve before training — every example in the
final dataset, not just a 30-sample slice, since the total (58) turned out
small enough that full review is more useful than partial sampling (the
original "~30 random samples" plan assumed a ~200-300 total).

Run from ai/:  python -m training.make_review_file
"""
from pathlib import Path

import json

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "processed"
INPUT_PATH = DATA_DIR / "train_final.jsonl"
OUTPUT_PATH = DATA_DIR / "review_sample.md"


def main() -> None:
    examples = [json.loads(line) for line in INPUT_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]

    lines = [
        "# Milestone 7 — Duyệt dữ liệu train trước khi fine-tune\n",
        f"Tổng cộng **{len(examples)} cặp hỏi–đáp**. Đọc qua, nếu thấy cặp nào dở/sai/không phù hợp thì ghi lại số thứ tự (#) gửi cho Claude để loại bỏ trước khi train.\n",
        "---\n",
    ]
    for i, example in enumerate(examples, start=1):
        question = example["messages"][1]["content"]
        answer = example["messages"][2]["content"]
        lines.append(f"## #{i}\n")
        lines.append(f"**Hỏi:** {question}\n")
        lines.append(f"**Đáp:**\n\n{answer}\n")
        lines.append("---\n")

    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(examples)} examples -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
