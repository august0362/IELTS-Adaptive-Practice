from training.markdown_sections import split_sections


def test_empty_text_produces_no_sections():
    assert split_sections("") == []


def test_single_heading_with_content():
    sections = split_sections("## Vòng quay\n\nNội dung mục này.")
    assert len(sections) == 1
    assert sections[0].heading == "Vòng quay"
    assert sections[0].level == 2
    assert sections[0].content == "Nội dung mục này."


def test_content_before_any_heading_is_dropped():
    # generate_template_data.py only ever asks about a *named* section — text
    # with no heading above it has nothing to attribute a question to.
    sections = split_sections("Đoạn mở đầu không có heading.\n\n## Mục 1\n\nNội dung.")
    assert len(sections) == 1
    assert sections[0].heading == "Mục 1"


def test_heading_with_no_content_is_dropped():
    sections = split_sections("## Mục rỗng\n\n## Mục có nội dung\n\nNội dung.")
    assert len(sections) == 1
    assert sections[0].heading == "Mục có nội dung"


def test_subsection_gets_its_own_entry_separate_from_parent():
    text = "## Mục 5\n\nGiới thiệu mục 5.\n\n### 5.1 Con\n\nNội dung con."
    sections = split_sections(text)
    assert len(sections) == 2
    assert sections[0] == pytest_section("Mục 5", 2, "Giới thiệu mục 5.")
    assert sections[1] == pytest_section("5.1 Con", 3, "Nội dung con.")


def test_multiple_paragraphs_stay_together_in_one_section():
    text = "## Mục 1\n\nĐoạn 1.\n\nĐoạn 2.\n\nĐoạn 3."
    sections = split_sections(text)
    assert len(sections) == 1
    assert "Đoạn 1." in sections[0].content
    assert "Đoạn 3." in sections[0].content


def pytest_section(heading: str, level: int, content: str):
    from training.markdown_sections import Section

    return Section(heading=heading, level=level, content=content)
