"""
Milestone 7 step 1 (AI_CHATBOT_PLAN.md section 12.2.1): template-based
training data — no model involved, no Kaggle needed. Scans the project's own
public docs (PROJECT_CONTEXT.md, USER_GUIDE.md) and turns selected sections
into {question, answer} pairs using hand-picked, natural-sounding question
phrasings (a generic "What is <heading>?" template reads far more robotic
than a real user's question, and the number of sections here is small enough
to phrase each by hand).

Deliberately narrow section selection: only *user-facing* sections (what the
app does, how the scoring formulas work, the theme system, the FAQ) — not
developer-facing ones (folder structure, DB schema, API contracts, test
strategy, the multi-agent framework). A real user asking Navita for help
would never ask "what's the DB schema", so generating training pairs for
that would just teach the model to answer a question nobody asks.

Run from ai/:  python -m training.generate_template_data
"""
import json
import re
from pathlib import Path

from server.prompt import SYSTEM_INSTRUCTION
from training.markdown_sections import Section, split_sections

REPO_ROOT = Path(__file__).resolve().parents[2]
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "train_template.jsonl"

# heading substring (case-sensitive match against the real heading text) ->
# 1+ natural question phrasings. First match wins if a heading contains
# multiple keys (shouldn't happen given how specific these are).
PROJECT_CONTEXT_QUESTIONS: dict[str, list[str]] = {
    "1. Tổng quan sản phẩm": ["App này dùng để làm gì?", "Giới thiệu qua về app này cho mình nghe."],
    "5.1 Cách chia nhỏ Kỹ năng/Part": ["Kỹ năng và Part trong app được chia nhỏ như thế nào?"],
    "5.2 Công thức 1": ["Công thức chọn ngẫu nhiên có trọng số của vòng quay hoạt động thế nào?"],
    "5.3 Công thức 2": ["Quy tắc bắt buộc hàng tuần trong vòng quay là gì?"],
    "5.4 Công thức 3": [
        "Công thức tính Band điểm dự đoán hoạt động thế nào?",
        "App dự đoán Band điểm dựa trên những gì?",
    ],
    "5.5 Quy tắc làm tròn": ["IELTS làm tròn điểm Band tổng theo quy tắc nào?"],
    "5.7 Dạng bài": ["Dạng bài (question types) hoạt động thế nào trong vòng quay?"],
    "5.8 Cộng luyện thủ công": ["Làm sao để cộng luyện tập mà không cần quay?"],
    "5.9 Xóa lượt quay": ["Xóa 1 lượt quay thì chuyện gì xảy ra với bộ đếm?"],
    "5.10 Trang thống kê": ["Trang thống kê theo kỹ năng cho biết những gì?"],
    "5.11 Chủ đề": ["Chủ đề (topics) trong app dùng để làm gì?"],
    "5.12 Ghi số câu đúng": ["Làm sao ghi số câu đúng khi luyện Reading hoặc Listening?"],
    "9. Hệ thống theme": ["App có bao nhiêu bảng màu giao diện và chọn thế nào?"],
}

USER_GUIDE_QUESTIONS: dict[str, list[str]] = {
    "Khởi động ứng dụng": ["Làm sao khởi động ứng dụng này?"],
    "1. Vòng quay": ["Trang Vòng quay dùng để làm gì?", "Cách dùng Vòng quay thế nào?"],
    "2. Nhật ký": ["Trang Nhật ký dùng để làm gì?"],
    "3. Dự đoán Band điểm": ["Trang Dự đoán Band điểm có những gì?"],
    "Nhập kết quả thi thử": ["Làm sao nhập kết quả thi thử Cambridge?"],
    "4. Navita — chatbot": ["Navita là gì và dùng thế nào?"],
    "5. Cài đặt": ["Trang Cài đặt dùng để làm gì?"],
}

BOLD_QA_RE = re.compile(r"\*\*(.+?)\*\*\s*\n(.+?)(?=\n\*\*|\Z)", re.DOTALL)


MARKDOWN_LINK_RE = re.compile(r"\[([^\]]+)\]\([^)]+\)")


def clean_answer(text: str) -> str:
    """Mechanical/syntactic cleanup ONLY — markdown link syntax, stray
    trailing dividers, excess blank lines. Deliberately does NOT rewrite,
    summarize, or drop whole sentences/paragraphs: that would mean *authoring*
    parts of the training answer, exactly what AI_CHATBOT_PLAN.md section 6
    ruled out doing with Claude. The result is a mechanical splice of the
    project's own docs, verbatim content preserved — including any verbose or
    dev-facing passages, which is precisely why the 30-sample review gate
    (section 12.2 step 5) exists: to judge that tradeoff, not to have it
    pre-cleaned away here."""
    text = MARKDOWN_LINK_RE.sub(r"\1", text)
    text = re.sub(r"\n{3,}", "\n\n", text.strip())
    text = re.sub(r"\n+---\s*$", "", text).strip()
    return text


def qa_pairs_from_headings(sections: list[Section], question_map: dict[str, list[str]]) -> list[dict]:
    pairs = []
    for section in sections:
        for key, questions in question_map.items():
            if key in section.heading:
                answer = clean_answer(section.content)
                for question in questions:
                    pairs.append({"question": question, "answer": answer})
                break
    return pairs


def qa_pairs_from_faq(faq_section_content: str) -> list[dict]:
    """USER_GUIDE.md's "Câu hỏi thường gặp" is already written as **Q**\\nA —
    parsed directly instead of templated, since it's already natural."""
    pairs = []
    for match in BOLD_QA_RE.finditer(faq_section_content):
        question, answer = match.group(1).strip(), match.group(2).strip()
        pairs.append({"question": question, "answer": clean_answer(answer)})
    return pairs


def to_training_example(question: str, answer: str) -> dict:
    return {
        "messages": [
            {"role": "system", "content": SYSTEM_INSTRUCTION},
            {"role": "user", "content": question},
            {"role": "assistant", "content": answer},
        ]
    }


def main() -> None:
    project_context = (REPO_ROOT / "PROJECT_CONTEXT.md").read_text(encoding="utf-8")
    user_guide = (REPO_ROOT / "USER_GUIDE.md").read_text(encoding="utf-8")

    pairs = []
    pairs += qa_pairs_from_headings(split_sections(project_context), PROJECT_CONTEXT_QUESTIONS)
    pairs += qa_pairs_from_headings(split_sections(user_guide), USER_GUIDE_QUESTIONS)

    faq_sections = [s for s in split_sections(user_guide) if s.heading == "Câu hỏi thường gặp"]
    for faq in faq_sections:
        pairs += qa_pairs_from_faq(faq.content)

    examples = [to_training_example(p["question"], p["answer"]) for p in pairs]

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8") as f:
        for example in examples:
            f.write(json.dumps(example, ensure_ascii=False) + "\n")

    print(f"Generated {len(examples)} template Q&A pairs -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
