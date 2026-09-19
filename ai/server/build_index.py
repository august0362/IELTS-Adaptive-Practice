"""
Rebuilds the RAG index whenever the source docs change. Needs Ollama running
with the embedding model already pulled (`ollama pull nomic-embed-text`) —
this is I/O-heavy and deliberately not part of the automated test suite.

Run from ai/:  python -m server.build_index
"""
import asyncio
import json
from pathlib import Path

from . import ollama_client
from .chunking import chunk_markdown

# ai/server/build_index.py -> ai/server -> ai -> repo root
REPO_ROOT = Path(__file__).resolve().parents[2]
SOURCE_DOCS = ["PROJECT_CONTEXT.md", "USER_GUIDE.md", "document.txt"]
OUTPUT_PATH = Path(__file__).resolve().parents[1] / "data" / "processed" / "doc_index.json"


async def main() -> None:
    all_chunks = []
    for filename in SOURCE_DOCS:
        text = (REPO_ROOT / filename).read_text(encoding="utf-8")
        all_chunks.extend(chunk_markdown(text, source=filename))

    indexed = []
    for chunk in all_chunks:
        embedding = await ollama_client.embed(chunk.text)
        indexed.append(
            {"source": chunk.source, "heading": chunk.heading, "text": chunk.text, "embedding": embedding}
        )

    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(indexed, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Indexed {len(indexed)} chunks from {len(SOURCE_DOCS)} docs -> {OUTPUT_PATH}")


if __name__ == "__main__":
    asyncio.run(main())
