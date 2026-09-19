"""
Pure prompt-assembly — no I/O, no model calls. See tests/test_prompt.py.
"""
from typing import Literal

from .retrieval import ScoredChunk

ChatMode = Literal["flash", "thinking", "pro"]

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

# Appended only in "pro" mode — flash/thinking share the exact same voice and
# only differ in reasoning depth (see main.py's think=True for thinking/pro),
# so there's nothing to add to SYSTEM_INSTRUCTION for them.
PRO_INSTRUCTION_SUFFIX = (
    "\n\nChế độ Pro đang bật: trả lời chi tiết và có cấu trúc rõ ràng hơn "
    "(dùng đoạn/gạch đầu dòng khi phù hợp), giọng văn trang trọng và chuyên "
    "nghiệp hơn, tận dụng tối đa các đoạn tài liệu liên quan được cung cấp."
)


def build_system_prompt(retrieved: list[ScoredChunk], db_context: str, mode: ChatMode = "flash") -> str:
    instruction = SYSTEM_INSTRUCTION + (PRO_INSTRUCTION_SUFFIX if mode == "pro" else "")
    parts = [instruction]

    if retrieved:
        parts.append("Tài liệu app liên quan:")
        for chunk in retrieved:
            parts.append(f"[{chunk.source} — {chunk.heading}]\n{chunk.text}")

    if db_context.strip():
        parts.append(f"Dữ liệu của bạn:\n{db_context.strip()}")

    return "\n\n".join(parts)
