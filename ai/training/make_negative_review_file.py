"""
Milestone 7 follow-up: writes a human-readable review file for the NEW
"negative" (honest-refusal) training examples ONLY — scoped separately
from the 58 already-approved examples (review_sample.md) so the user
isn't asked to re-review content already approved.

Each entry needs a different kind of check than the original 58: not
"is this answer factually correct" but "is the question genuinely NOT
answered by the app/docs, and is the refusal honest (no invented facts)?"
— since each pair was generated seeing only its own source chunk, a
question could in principle be answerable from a DIFFERENT part of the
docs (see kaggle_negative_generation.py's docstring) — that's exactly
what this review step exists to catch.

Run from ai/:  python -m training.make_negative_review_file
"""
from pathlib import Path

import json

DATA_DIR = Path(__file__).resolve().parents[1] / "data" / "processed"
INPUT_PATH = DATA_DIR / "negative_candidates.jsonl"
OUTPUT_PATH = DATA_DIR / "negative_review_sample.md"


def main() -> None:
    pairs = [json.loads(line) for line in INPUT_PATH.read_text(encoding="utf-8").splitlines() if line.strip()]

    lines = [
        "# Milestone 7 (bổ sung) — Duyệt dữ liệu \"từ chối trung thực\" trước khi ghép vào tập train\n",
        f"Tổng cộng **{len(pairs)} cặp**. Đây là mẫu dạy chatbot cách nói \"không chắc\" cho câu hỏi "
        "ngoài phạm vi tài liệu — khác loại với 58 mẫu đã duyệt trước (câu hỏi có đáp án thật).\n",
        "**Khi đọc, kiểm 2 điều cho mỗi cặp:**\n",
        "1. Câu hỏi có thực sự **KHÔNG được trả lời** ở bất kỳ đâu trong app/tài liệu không? "
        "(model chỉ thấy 1 đoạn khi tạo câu này — có thể vô tình hỏi trúng thứ thật ra ĐÃ có "
        "trong 1 phần khác của tài liệu mà model không thấy lúc đó — nếu vậy, loại cặp này.)\n",
        "2. Câu trả lời có thực sự **từ chối trung thực** (không bịa thêm gì) không?\n",
        "\n"
        "Ghi lại số thứ tự (#) của cặp nào cần loại, gửi cho Claude.\n",
        "---\n",
    ]
    for i, pair in enumerate(pairs, start=1):
        lines.append(f"## #{i} — nguồn: {pair['source']} — {pair['heading']}\n")
        lines.append(f"**Hỏi:** {pair['question']}\n")
        lines.append(f"**Đáp (từ chối):**\n\n{pair['answer']}\n")
        lines.append("---\n")

    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {len(pairs)} pairs -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
