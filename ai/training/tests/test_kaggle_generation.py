import json

import pytest

from training.kaggle_generation import build_prompt, extract_json_array, process_one, run_parallel


def test_build_prompt_includes_source_heading_and_text():
    chunk = {"source": "USER_GUIDE.md", "heading": "1. Vòng quay", "text": "Nội dung mẫu."}
    prompt = build_prompt(chunk)
    assert "USER_GUIDE.md" in prompt
    assert "1. Vòng quay" in prompt
    assert "Nội dung mẫu." in prompt


class TestExtractJsonArray:
    def test_parses_a_plain_json_array(self):
        result = extract_json_array('[{"question": "Q1?", "answer": "A1."}]')
        assert result == [{"question": "Q1?", "answer": "A1."}]

    def test_parses_json_wrapped_in_a_markdown_code_fence(self):
        text = '```json\n[{"question": "Q1?", "answer": "A1."}]\n```'
        assert extract_json_array(text) == [{"question": "Q1?", "answer": "A1."}]

    def test_parses_json_with_extra_surrounding_text(self):
        text = 'Đây là kết quả:\n[{"question": "Q1?", "answer": "A1."}]\nHết.'
        assert extract_json_array(text) == [{"question": "Q1?", "answer": "A1."}]

    def test_wraps_a_bare_object_into_a_one_element_array(self):
        # Real bug found on Kaggle (2026-09-20, negative-example generation): asking
        # for exactly 1 pair made the model reply with a bare {question, answer}
        # object (no outer array) far more often than the original "1-2 pairs"
        # prompt did -- rejecting this outright silently lost 21 of 37 otherwise-good
        # generated pairs. Wrapping recovers them without loosening per-item validation.
        result = extract_json_array('{"question": "Q1?", "answer": "A1."}')
        assert result == [{"question": "Q1?", "answer": "A1."}]

    def test_still_rejects_a_bare_object_missing_required_keys(self):
        with pytest.raises(ValueError):
            extract_json_array('{"question": "Q1?"}')

    def test_parses_a_bare_object_wrapped_in_a_markdown_code_fence(self):
        text = '```json\n{"question": "Q1?", "answer": "A1."}\n```'
        assert extract_json_array(text) == [{"question": "Q1?", "answer": "A1."}]

    def test_parses_multiple_pairs(self):
        text = '[{"question": "Q1?", "answer": "A1."}, {"question": "Q2?", "answer": "A2."}]'
        assert len(extract_json_array(text)) == 2

    def test_rejects_a_list_of_plain_strings(self):
        # The real bug found live on Kaggle: the model replied with a list of
        # question strings instead of {question, answer} objects. Silently
        # accepting this crashed the *downstream* aggregation step instead
        # (`**pair` on a str) — this must fail right here, loudly, so
        # process_one below can catch it as "this chunk failed" instead.
        with pytest.raises(ValueError):
            extract_json_array('["Câu hỏi 1?", "Câu hỏi 2?"]')

    def test_rejects_a_non_string_scalar(self):
        with pytest.raises(ValueError):
            extract_json_array('"just a string"')

    def test_rejects_items_missing_the_answer_key(self):
        with pytest.raises(ValueError):
            extract_json_array('[{"question": "Q1?"}]')

    def test_rejects_non_string_question_or_answer(self):
        with pytest.raises(ValueError):
            extract_json_array('[{"question": 123, "answer": "A1."}]')

    def test_rejects_text_with_no_json_at_all(self):
        with pytest.raises(json.JSONDecodeError):
            extract_json_array("Xin lỗi, tôi không thể tạo câu hỏi cho đoạn này.")


def test_process_one_returns_pairs_on_success():
    chunk = {"source": "doc.md", "heading": "Mục 1", "text": "..."}
    result = process_one((0, chunk), lambda c, gpu: [{"question": "Q?", "answer": "A."}], gpu_ids=[0])
    assert result == {"index": 0, "source": "doc.md", "heading": "Mục 1", "pairs": [{"question": "Q?", "answer": "A."}], "error": None}


def test_process_one_catches_an_exception_from_generate_fn_instead_of_raising():
    chunk = {"source": "doc.md", "heading": "Mục lỗi", "text": "..."}

    def failing_generate(c, gpu):
        raise ValueError("simulated failure")

    result = process_one((3, chunk), failing_generate, gpu_ids=[0])
    assert result["error"] == "simulated failure"
    assert result["pairs"] == []
    assert result["index"] == 3


def test_process_one_picks_gpu_by_round_robin():
    chunk = {"source": "doc.md", "heading": "Mục", "text": "..."}
    seen_gpu_ids = []

    def recording_generate(c, gpu):
        seen_gpu_ids.append(gpu)
        return []

    process_one((0, chunk), recording_generate, gpu_ids=["a", "b"])
    process_one((1, chunk), recording_generate, gpu_ids=["a", "b"])
    process_one((2, chunk), recording_generate, gpu_ids=["a", "b"])

    assert seen_gpu_ids == ["a", "b", "a"]


def test_run_parallel_processes_every_chunk_exactly_once_and_isolates_errors():
    chunks = [{"source": "doc.md", "heading": f"Mục {i}", "text": "..."} for i in range(10)]
    chunks[4]["heading"] = "Mục LỖI 4"

    def generate(chunk, gpu_id):
        if "LỖI" in chunk["heading"]:
            raise RuntimeError("simulated failure")
        return [{"question": f"Q for {chunk['heading']}", "answer": "A"}]

    collected = []
    results = run_parallel(chunks, generate, gpu_ids=[0, 1], on_result=lambda r: collected.append(r))

    assert len(results) == 10
    assert len(collected) == 10  # on_result called for every chunk, not just successes
    indices = sorted(r["index"] for r in results)
    assert indices == list(range(10))
    errors = [r for r in results if r["error"]]
    assert len(errors) == 1
    assert errors[0]["index"] == 4


def test_run_parallel_with_a_single_gpu_id_runs_sequentially_without_error():
    chunks = [{"source": "doc.md", "heading": f"Mục {i}", "text": "..."} for i in range(5)]
    results = run_parallel(chunks, lambda c, gpu: [{"question": "Q", "answer": "A"}], gpu_ids=[0])
    assert len(results) == 5
    assert all(r["error"] is None for r in results)
