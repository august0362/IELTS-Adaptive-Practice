from training.generate_template_data import clean_answer, qa_pairs_from_faq, qa_pairs_from_headings
from training.markdown_sections import Section


def test_clean_answer_strips_markdown_link_syntax_keeping_the_label():
    assert clean_answer("Xem thêm ở [document.txt](./document.txt) để biết chi tiết.") == (
        "Xem thêm ở document.txt để biết chi tiết."
    )


def test_clean_answer_strips_a_trailing_divider():
    assert clean_answer("Nội dung chính.\n\n---") == "Nội dung chính."


def test_clean_answer_collapses_excess_blank_lines():
    assert clean_answer("Đoạn 1.\n\n\n\nĐoạn 2.") == "Đoạn 1.\n\nĐoạn 2."


def test_clean_answer_does_not_touch_real_content():
    # The whole point (see the function's docstring): only syntax is
    # normalized, no sentence is ever removed or reworded.
    text = "**Lý do kỹ thuật**: dùng EWMA vì dữ liệu quá nhỏ để train model học máy."
    assert clean_answer(text) == text


def test_qa_pairs_from_headings_matches_by_substring_and_supports_multiple_questions():
    sections = [Section(heading="5.4 Công thức 3 — Dự đoán Band", level=3, content="Nội dung công thức.")]
    question_map = {"5.4 Công thức 3": ["Câu hỏi 1?", "Câu hỏi 2?"]}

    pairs = qa_pairs_from_headings(sections, question_map)

    assert pairs == [
        {"question": "Câu hỏi 1?", "answer": "Nội dung công thức."},
        {"question": "Câu hỏi 2?", "answer": "Nội dung công thức."},
    ]


def test_qa_pairs_from_headings_skips_unmapped_sections():
    sections = [Section(heading="Mục không nằm trong danh sách", level=2, content="Nội dung.")]
    assert qa_pairs_from_headings(sections, {"5.4": ["Câu hỏi?"]}) == []


def test_qa_pairs_from_faq_parses_bold_question_then_answer_paragraph():
    faq_text = (
        "**Xác suất quay có tính theo ngày không?**\n"
        "Chỉ theo số lần xuất hiện.\n\n"
        "**Đổi máy khác thì mất dữ liệu không?**\n"
        "Có, vì dữ liệu lưu trên máy hiện tại."
    )

    pairs = qa_pairs_from_faq(faq_text)

    assert pairs == [
        {"question": "Xác suất quay có tính theo ngày không?", "answer": "Chỉ theo số lần xuất hiện."},
        {"question": "Đổi máy khác thì mất dữ liệu không?", "answer": "Có, vì dữ liệu lưu trên máy hiện tại."},
    ]


def test_qa_pairs_from_faq_of_empty_text_is_empty():
    assert qa_pairs_from_faq("") == []
