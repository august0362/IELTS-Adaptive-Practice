"""
Pure text-chunking logic for the RAG pipeline — no I/O, no model calls, so
it's fully unit-testable with plain strings. See tests/test_chunking.py.
"""
import re
from dataclasses import dataclass


@dataclass
class Chunk:
    source: str
    """Which doc this came from, e.g. "PROJECT_CONTEXT.md" — shown back to the
    model as a citation so answers can say roughly where a fact came from."""
    heading: str
    """Nearest preceding markdown '#' heading above this chunk."""
    text: str


def _split_oversized_paragraph(para: str, max_chars: int) -> list[str]:
    """
    A single paragraph (no blank line inside it) can still be longer than
    max_chars on its own — e.g. a long block-quote-heavy narrative paragraph
    with no blank lines — which chunk_markdown's normal pack-multiple-
    paragraphs logic never splits, since it only ever flushes *before*
    adding a new paragraph. Falls back to splitting on sentence boundaries
    first (keeps citations readable), then hard character slicing for any
    single "sentence" still too long (no punctuation at all).
    """
    if len(para) <= max_chars:
        return [para]

    sentences = re.split(r"(?<=[.!?])\s+", para)
    pieces: list[str] = []
    buffer = ""
    for sentence in sentences:
        if len(sentence) > max_chars:
            if buffer:
                pieces.append(buffer)
                buffer = ""
            # No punctuation to split on at all — hard-slice as a last resort.
            pieces.extend(sentence[i : i + max_chars] for i in range(0, len(sentence), max_chars))
            continue

        if buffer and len(buffer) + 1 + len(sentence) > max_chars:
            pieces.append(buffer)
            buffer = sentence
        else:
            buffer = f"{buffer} {sentence}".strip()

    if buffer:
        pieces.append(buffer)
    return pieces


def chunk_markdown(text: str, source: str, max_chars: int = 1200) -> list[Chunk]:
    """
    Splits markdown into chunks along paragraph boundaries (blank lines),
    packing consecutive paragraphs together up to `max_chars` per chunk —
    simple paragraph-packing rather than a fixed-size sliding window, so a
    chunk boundary usually lands on a paragraph break rather than mid-
    sentence. A paragraph longer than max_chars on its own is further split
    by _split_oversized_paragraph — this guarantee matters in practice, not
    just in theory: without it, a chunk gets rejected outright by embedding
    models with a fixed input-length limit (hit for real with
    nomic-embed-text on one of PROJECT_CONTEXT.md's longer narrative
    paragraphs — see tests/test_chunking.py). Tracks the nearest preceding
    '#'-heading so each chunk knows which section it came from.

    No overlap between chunks (deliberately, for this first pass): the
    project's source docs are a handful of markdown files, not huge corpora,
    so a fact split across a chunk boundary is an acceptable, rare cost
    against the simplicity of not having to reason about overlap windows.
    """
    paragraphs = [p.strip() for p in text.split("\n\n") if p.strip()]

    chunks: list[Chunk] = []
    current_heading = source
    buffer_parts: list[str] = []
    buffer_heading = current_heading
    buffer_len = 0

    def flush() -> None:
        if buffer_parts:
            chunks.append(Chunk(source=source, heading=buffer_heading, text="\n\n".join(buffer_parts)))

    for para in paragraphs:
        first_line = para.splitlines()[0]
        if first_line.startswith("#"):
            current_heading = first_line.lstrip("#").strip()

        if len(para) > max_chars:
            flush()
            buffer_parts = []
            buffer_len = 0
            for piece in _split_oversized_paragraph(para, max_chars):
                chunks.append(Chunk(source=source, heading=current_heading, text=piece))
            continue

        if buffer_len + len(para) > max_chars and buffer_parts:
            flush()
            buffer_parts = []
            buffer_len = 0
            buffer_heading = current_heading

        if not buffer_parts:
            buffer_heading = current_heading
        buffer_parts.append(para)
        buffer_len += len(para)

    flush()
    return chunks
