"""
Pure markdown section-splitting for the Milestone 7 template data generator —
no I/O. See tests/test_markdown_sections.py. Deliberately simpler than
ai/server/chunking.py: that one packs small paragraphs together for RAG
retrieval chunks; this one keeps each heading's content as one whole block,
since generate_template_data.py needs "the answer for this heading" as a
single coherent unit, not retrieval-sized pieces.
"""
import re
from dataclasses import dataclass

HEADING_RE = re.compile(r"^(#{1,6})\s+(.*)$")


@dataclass
class Section:
    heading: str
    level: int
    content: str


def split_sections(text: str) -> list[Section]:
    lines = text.splitlines()
    sections: list[Section] = []
    current_heading: str | None = None
    current_level = 0
    buffer: list[str] = []

    def flush() -> None:
        if current_heading is not None:
            content = "\n".join(buffer).strip()
            if content:
                sections.append(Section(heading=current_heading, level=current_level, content=content))

    for line in lines:
        match = HEADING_RE.match(line)
        if match:
            flush()
            current_level = len(match.group(1))
            current_heading = match.group(2).strip()
            buffer = []
        else:
            buffer.append(line)
    flush()
    return sections
