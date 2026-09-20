# -*- coding: utf-8 -*-
"""One-off script for Milestone 7 §12.5 evaluation: asks the same 10 questions
to the base model (qwen3.5:4b) and the fine-tuned model (qwen3.5-4b-project),
Flash mode (think=False), saves both sets of answers to JSON for comparison.
Not part of the test suite -- a throwaway eval helper, run manually."""
import json
import sys
import time
from pathlib import Path

import httpx

SYSTEM_INSTRUCTION = (
    "Bạn là Navita, chatbot của 1 app luyện thi IELTS cá nhân. Trả lời bằng "
    "đúng ngôn ngữ mà người dùng dùng để hỏi (hỏi tiếng Việt thì đáp tiếng "
    "Việt, hỏi tiếng Anh thì đáp tiếng Anh), giữ thuật ngữ/ví dụ IELTS bằng "
    "tiếng Anh khi cần. Bạn giúp 3 việc: (1) giải thích cách dùng app dựa trên "
    "phần 'Tài liệu app' bên dưới nếu có, (2) trả lời kiến thức IELTS chung, "
    "(3) tư vấn luyện tập dựa trên phần 'Dữ liệu của bạn' bên dưới nếu có. "
    "Nếu không chắc hoặc tài liệu không đề cập, nói rõ là không chắc thay vì "
    "bịa ra thông tin."
)

QUESTIONS = [
    # 6 held out from training (eval_fraction=0.1, seed=7) -- known-correct reference answers
    ("held-out #1", "Màu nào trong hệ thống theme là điểm duy nhất còn thể hiện sự khác biệt giữa theme sáng và theme tối?"),
    ("held-out #2", "Navita là gì và dùng thế nào?"),
    ("held-out #3", "Giới thiệu qua về app này cho mình nghe."),
    ("held-out #4", "IELTS làm tròn điểm Band tổng theo quy tắc nào?"),
    ("held-out #5", "Công thức tính Band điểm dự đoán hoạt động thế nào?"),
    ("held-out #6", "Xác suất hiển thị trên mỗi thẻ khi quay được tính dựa trên tiêu chí nào?"),
    # 4 new, not in the 58 approved examples at all
    ("new (EN)", "What does the Task Achievement criterion assess in IELTS Writing Task 1?"),
    ("new (VI, general IELTS)", "IELTS Writing Task 2 chấm theo mấy tiêu chí, đó là gì?"),
    ("new (VI, honesty check)", "App có tính năng nhắc lịch luyện tập vào giờ cố định mỗi ngày không?"),
    ("new (VI, general advice)", "Làm sao để cải thiện điểm Speaking IELTS nhanh nhất?"),
]

MODELS = ["qwen3.5:4b", "qwen3.5-4b-project"]
OUT_PATH = Path(__file__).parent / "output" / "eval_results.json"


def ask(model: str, question: str) -> str:
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": question},
        ],
        "think": False,
        "stream": False,
    }
    with httpx.Client(timeout=httpx.Timeout(300.0)) as client:
        res = client.post("http://127.0.0.1:11434/api/chat", json=payload)
        res.raise_for_status()
        return res.json()["message"]["content"]


def main() -> None:
    results = []
    total = len(QUESTIONS) * len(MODELS)
    done = 0
    for label, question in QUESTIONS:
        entry = {"label": label, "question": question}
        for model in MODELS:
            t0 = time.time()
            answer = ask(model, question)
            dt = time.time() - t0
            entry[model] = {"answer": answer, "seconds": round(dt, 1)}
            done += 1
            print(f"[{done}/{total}] {model} -- {label} ({dt:.1f}s)", flush=True)
        results.append(entry)
        OUT_PATH.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"Done. Wrote {OUT_PATH}", flush=True)


if __name__ == "__main__":
    main()
