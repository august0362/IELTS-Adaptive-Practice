from training.extract_kaggle_chunks import is_allowed


def test_rejects_a_source_outside_project_context_and_user_guide():
    chunk = {"source": "document.txt", "heading": "5.4 Công thức 3", "text": "..."}
    assert is_allowed(chunk) is False


def test_rejects_a_heading_not_in_the_curated_list():
    # e.g. section 4 (DB schema) or the meta-preamble before any real heading
    # (heading == the filename itself, per ai/server/chunking.py) — the real
    # bug found live on Kaggle: this exact case produced a dev-facing Q&A pair.
    chunk = {"source": "PROJECT_CONTEXT.md", "heading": "PROJECT_CONTEXT.md — App luyện thi IELTS thích ứng", "text": "..."}
    assert is_allowed(chunk) is False


def test_accepts_a_curated_project_context_heading():
    chunk = {"source": "PROJECT_CONTEXT.md", "heading": "5.4 Công thức 3 — Dự đoán Band điểm (v2)", "text": "..."}
    assert is_allowed(chunk) is True


def test_accepts_a_curated_user_guide_heading():
    chunk = {"source": "USER_GUIDE.md", "heading": "1. Vòng quay (trang chủ `/`)", "text": "..."}
    assert is_allowed(chunk) is True
