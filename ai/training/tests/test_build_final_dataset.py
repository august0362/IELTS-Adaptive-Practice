from training.build_final_dataset import cap_per_heading, deduplicate, similarity, to_training_example


def test_similarity_of_identical_strings_is_one():
    assert similarity("Câu hỏi giống hệt?", "Câu hỏi giống hệt?") == 1.0


def test_similarity_ignores_case_and_surrounding_whitespace():
    assert similarity("  Câu Hỏi?  ", "câu hỏi?") == 1.0


def test_similarity_of_unrelated_strings_is_low():
    assert similarity("Vòng quay hoạt động thế nào?", "Trang Cài đặt dùng để làm gì?") < 0.5


def _pair(question: str, heading: str = "Mục A", source: str = "doc.md") -> dict:
    return {"source": source, "heading": heading, "question": question, "answer": "Đáp án."}


class TestDeduplicate:
    def test_keeps_all_when_all_questions_are_distinct(self):
        pairs = [_pair("Câu 1?"), _pair("Câu 2?"), _pair("Câu 3?")]
        assert deduplicate(pairs) == pairs

    def test_drops_a_near_duplicate_question_keeping_the_first(self):
        pairs = [_pair("App này dùng để làm gì?"), _pair("App này dùng để làm gì ạ?")]
        result = deduplicate(pairs)
        assert len(result) == 1
        assert result[0]["question"] == "App này dùng để làm gì?"

    def test_empty_list_stays_empty(self):
        assert deduplicate([]) == []


class TestCapPerHeading:
    def test_keeps_everything_under_the_cap(self):
        pairs = [_pair("Q1"), _pair("Q2")]
        assert cap_per_heading(pairs, max_per_heading=4) == pairs

    def test_caps_a_heading_that_exceeds_the_limit(self):
        pairs = [_pair(f"Q{i}") for i in range(10)]
        result = cap_per_heading(pairs, max_per_heading=3)
        assert len(result) == 3
        assert [p["question"] for p in result] == ["Q0", "Q1", "Q2"]

    def test_caps_each_heading_independently(self):
        pairs = [_pair("A1", heading="A"), _pair("A2", heading="A"), _pair("A3", heading="A"), _pair("B1", heading="B")]
        result = cap_per_heading(pairs, max_per_heading=2)
        headings = [p["heading"] for p in result]
        assert headings.count("A") == 2
        assert headings.count("B") == 1

    def test_caps_independently_per_source_too_not_just_heading(self):
        # 2 different docs could share a heading string by coincidence — must not merge their counts.
        pairs = [_pair("Q1", heading="Mục chung", source="doc1.md"), _pair("Q2", heading="Mục chung", source="doc2.md")]
        assert cap_per_heading(pairs, max_per_heading=1) == pairs


def test_to_training_example_shape():
    example = to_training_example("Câu hỏi?", "Đáp án.")
    roles = [m["role"] for m in example["messages"]]
    assert roles == ["system", "user", "assistant"]
    assert example["messages"][1]["content"] == "Câu hỏi?"
    assert example["messages"][2]["content"] == "Đáp án."
