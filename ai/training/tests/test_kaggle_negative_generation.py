from training.kaggle_negative_generation import (
    NEGATIVE_GENERATION_SYSTEM_PROMPT,
    build_negative_prompt,
    extract_json_array,
    process_one,
    run_parallel,
)


def test_build_negative_prompt_includes_source_heading_and_text():
    chunk = {"source": "USER_GUIDE.md", "heading": "1. Vòng quay", "text": "Nội dung mẫu."}
    prompt = build_negative_prompt(chunk)
    assert "USER_GUIDE.md" in prompt
    assert "1. Vòng quay" in prompt
    assert "Nội dung mẫu." in prompt


def test_build_negative_prompt_instructs_an_unanswerable_question_and_honest_refusal():
    chunk = {"source": "doc.md", "heading": "Mục", "text": "..."}
    prompt = build_negative_prompt(chunk)
    assert "KHÔNG trả lời được" in prompt
    assert "không bịa" in prompt


def test_system_prompt_forbids_inventing_facts():
    assert "KHÔNG được bịa" in NEGATIVE_GENERATION_SYSTEM_PROMPT


def test_reexports_shared_generation_helpers_for_notebook_embedding():
    # kaggle_negative_generation.py imports these from kaggle_generation.py rather
    # than duplicating them -- this just confirms the re-export actually works
    # (the notebook builder embeds both files' source, so these names must resolve).
    assert callable(extract_json_array)
    assert callable(process_one)
    assert callable(run_parallel)

    result = process_one((0, {"source": "d", "heading": "h", "text": "t"}), lambda c, gpu: [{"question": "Q?", "answer": "A."}], gpu_ids=[0])
    assert result["pairs"] == [{"question": "Q?", "answer": "A."}]
