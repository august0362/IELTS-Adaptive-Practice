from server.chunking import chunk_markdown


def test_empty_text_produces_no_chunks():
    assert chunk_markdown("", source="doc.md") == []


def test_single_short_paragraph_is_one_chunk():
    chunks = chunk_markdown("Một đoạn văn ngắn.", source="doc.md")
    assert len(chunks) == 1
    assert chunks[0].text == "Một đoạn văn ngắn."
    assert chunks[0].source == "doc.md"


def test_packs_multiple_short_paragraphs_into_one_chunk():
    text = "Đoạn 1.\n\nĐoạn 2.\n\nĐoạn 3."
    chunks = chunk_markdown(text, source="doc.md", max_chars=1000)
    assert len(chunks) == 1
    assert "Đoạn 1." in chunks[0].text
    assert "Đoạn 3." in chunks[0].text


def test_splits_into_multiple_chunks_once_max_chars_exceeded():
    para_a = "A" * 100
    para_b = "B" * 100
    chunks = chunk_markdown(f"{para_a}\n\n{para_b}", source="doc.md", max_chars=150)
    assert len(chunks) == 2
    assert chunks[0].text == para_a
    assert chunks[1].text == para_b


def test_tracks_nearest_preceding_heading():
    text = "# Mục 1\n\nNội dung mục 1.\n\n## Mục 1.1\n\nNội dung mục 1.1."
    chunks = chunk_markdown(text, source="doc.md", max_chars=20)
    headings = [c.heading for c in chunks]
    assert "Mục 1" in headings
    assert "Mục 1.1" in headings


def test_falls_back_to_source_name_as_heading_before_any_heading_seen():
    chunks = chunk_markdown("Đoạn văn không có heading nào phía trước.", source="doc.md")
    assert chunks[0].heading == "doc.md"


def test_splits_a_single_oversized_paragraph_on_sentence_boundaries():
    # Real bug this regression-tests: a single paragraph (no blank line inside
    # it) longer than max_chars used to pass straight through as one giant
    # chunk — chunk_markdown only ever flushed *before* adding a new paragraph,
    # never split the paragraph itself. Hit for real embedding a long
    # block-quote-heavy paragraph from PROJECT_CONTEXT.md against
    # nomic-embed-text, which rejected it with "input length exceeds the
    # context length".
    sentence = "Đây là một câu ví dụ có dấu chấm câu rõ ràng."  # ~46 chars
    para = " ".join([sentence] * 10)  # ~470 chars, well over max_chars=100
    chunks = chunk_markdown(para, source="doc.md", max_chars=100)

    assert len(chunks) > 1
    assert all(len(c.text) <= 100 for c in chunks)
    # No sentence content lost or duplicated across the split.
    assert "".join(c.text for c in chunks).replace(" ", "") == para.replace(" ", "")


def test_splits_an_oversized_paragraph_with_no_punctuation_at_all():
    para = "A" * 350  # one giant "word", nothing to split on but hard slicing
    chunks = chunk_markdown(para, source="doc.md", max_chars=100)

    assert len(chunks) == 4  # 100+100+100+50
    assert all(len(c.text) <= 100 for c in chunks)
    assert "".join(c.text for c in chunks) == para


def test_oversized_paragraph_does_not_get_merged_with_neighboring_short_paragraphs():
    short_before = "Đoạn ngắn trước."
    long_para = "Câu dài. " * 30  # well over max_chars
    short_after = "Đoạn ngắn sau."
    text = f"{short_before}\n\n{long_para}\n\n{short_after}"

    chunks = chunk_markdown(text, source="doc.md", max_chars=100)

    assert chunks[0].text == short_before
    assert chunks[-1].text == short_after
    assert all(len(c.text) <= 100 for c in chunks)
