"""
Pure vector-similarity ranking for RAG retrieval — no I/O, no model calls.
The whole corpus is a handful of project docs (not millions of rows), so a
linear cosine-similarity scan is simple and fast enough; no vector DB needed.
See tests/test_retrieval.py.
"""
from dataclasses import dataclass

import numpy as np


@dataclass
class ScoredChunk:
    text: str
    heading: str
    source: str
    score: float


def cosine_similarity(a: np.ndarray, b: np.ndarray) -> float:
    denom = np.linalg.norm(a) * np.linalg.norm(b)
    if denom == 0:
        return 0.0
    return float(np.dot(a, b) / denom)


def top_k(query_embedding: np.ndarray, indexed_chunks: list[dict], k: int = 4) -> list[ScoredChunk]:
    """
    `indexed_chunks` items: {"text": str, "heading": str, "source": str,
    "embedding": list[float]} — exactly the shape build_index.py writes to
    ai/data/processed/doc_index.json.
    """
    scored = [
        ScoredChunk(
            text=c["text"],
            heading=c["heading"],
            source=c["source"],
            score=cosine_similarity(query_embedding, np.array(c["embedding"])),
        )
        for c in indexed_chunks
    ]
    scored.sort(key=lambda s: s.score, reverse=True)
    return scored[:k]
