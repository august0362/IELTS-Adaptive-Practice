from server.prompt import SYSTEM_INSTRUCTION, build_system_prompt
from server.retrieval import ScoredChunk


def test_prompt_with_no_retrieval_and_no_db_context_is_just_the_instruction():
    prompt = build_system_prompt([], "")
    assert prompt == SYSTEM_INSTRUCTION


def test_prompt_includes_retrieved_chunks_with_their_source_and_heading():
    chunk = ScoredChunk(text="Nội dung mẫu.", heading="Mục 5.4", source="PROJECT_CONTEXT.md", score=0.9)
    prompt = build_system_prompt([chunk], "")
    assert "PROJECT_CONTEXT.md" in prompt
    assert "Mục 5.4" in prompt
    assert "Nội dung mẫu." in prompt


def test_prompt_includes_db_context_when_present():
    prompt = build_system_prompt([], "Lịch sử luyện tập: ...")
    assert "Dữ liệu của bạn" in prompt
    assert "Lịch sử luyện tập: ..." in prompt


def test_prompt_ignores_whitespace_only_db_context():
    # SYSTEM_INSTRUCTION itself mentions "Dữ liệu của bạn" in passing (describing
    # what the bot does), so the real assertion is "no context section got
    # appended at all" — i.e. identical to the empty-string case — not a bare
    # substring check, which that mention would trivially satisfy either way.
    assert build_system_prompt([], "   \n  ") == build_system_prompt([], "")
