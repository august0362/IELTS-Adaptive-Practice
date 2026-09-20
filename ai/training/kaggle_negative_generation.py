"""
Pure/testable logic for generating NEGATIVE (refusal/honesty) training
examples — Milestone 7 follow-up after eval found a real, serious failure
(see AI_TASKS.md): the fine-tuned model confidently INVENTED a feature that
doesn't exist, instead of saying "không chắc", for a question outside the
original 58-example dataset. Root cause: all 58 approved examples are
real-question-with-real-answer pairs — there was not a single example
teaching "the honest answer here is 'I don't know'", so the model never
learned that behavior; it only learned to always answer confidently and
specifically (the stylistic thing fine-tuning was actually asked to do).

Same generation mechanism as kaggle_generation.py (Qwen3.5-9B on Kaggle,
NOT Claude — see AI_CHATBOT_PLAN.md §6 on why Claude's own output can never
be used as training-data content), same shape-validation
(`extract_json_array`), same parallel-chunk-processing scaffolding
(`process_one`/`run_parallel`) — imported from kaggle_generation.py rather
than duplicated. Only the *task given to the model* differs: instead of
"answer a question this chunk actually covers", it's "invent a natural,
plausible-sounding question ADJACENT to this chunk's topic that this chunk
does NOT actually answer, then answer it honestly by admitting the
information isn't available — do not guess or invent facts to fill the
gap." The model is deliberately not shown the other 36 chunks, so a
generated question could in principle be answered by a *different* chunk;
that's a real, known limitation of this per-chunk approach, and exactly why
a full human review pass (make_negative_review_file.py) happens before any
of this is added to the training set — the same discipline already applied
to the original 58 examples.

Run tests from ai/:  python -m pytest training/tests/test_kaggle_negative_generation.py
"""
from training.kaggle_generation import extract_json_array, process_one, run_parallel  # noqa: F401  (re-exported for notebook embedding)

NEGATIVE_GENERATION_SYSTEM_PROMPT = (
    "Bạn là trợ lý giúp tạo dữ liệu huấn luyện cho 1 chatbot hỏi đáp về ứng dụng luyện thi "
    "IELTS. Nhiệm vụ LẦN NÀY: đọc 1 đoạn tài liệu, rồi:\n"
    "1. Đặt 1 câu hỏi TỰ NHIÊN, nghe có vẻ liên quan đến chủ đề của đoạn, nhưng đoạn "
    "KHÔNG hề trả lời được câu hỏi đó (hỏi sang 1 tính năng/chi tiết KHÁC, gần chủ đề "
    "nhưng không có trong nội dung đoạn này).\n"
    "2. Viết câu trả lời là 1 lời từ chối lịch sự, ngắn gọn: thừa nhận không chắc/tài liệu "
    "không đề cập, KHÔNG được bịa ra thông tin để trả lời câu hỏi đó.\n"
    "Mục đích: dạy chatbot cách thừa nhận không biết thay vì bịa, khi gặp câu hỏi ngoài "
    "phạm vi tài liệu. Trả lời DUY NHẤT bằng JSON dạng "
    '[{"question": "...", "answer": "..."}], không thêm chữ nào khác ngoài JSON.'
)


def build_negative_prompt(chunk: dict) -> str:
    return (
        f"Đoạn tài liệu (nguồn: {chunk['source']} — {chunk['heading']}):\n\n"
        f"{chunk['text']}\n\n"
        "Đặt 1 câu hỏi tự nhiên nhưng đoạn trên KHÔNG trả lời được (hỏi sang 1 khía cạnh/"
        "tính năng khác gần chủ đề), và viết câu trả lời là lời từ chối lịch sự thừa nhận "
        "không chắc/không có thông tin — không bịa. Trả lời bằng JSON."
    )
