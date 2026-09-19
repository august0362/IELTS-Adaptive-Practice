import numpy as np

from server.retrieval import cosine_similarity, top_k


def test_cosine_similarity_of_identical_vectors_is_one():
    v = np.array([1.0, 2.0, 3.0])
    assert cosine_similarity(v, v) == 1.0


def test_cosine_similarity_of_orthogonal_vectors_is_zero():
    a = np.array([1.0, 0.0])
    b = np.array([0.0, 1.0])
    assert cosine_similarity(a, b) == 0.0


def test_cosine_similarity_handles_zero_vector_without_dividing_by_zero():
    a = np.array([0.0, 0.0])
    b = np.array([1.0, 1.0])
    assert cosine_similarity(a, b) == 0.0


def _chunk(text: str, embedding: list[float]) -> dict:
    return {"text": text, "heading": "h", "source": "doc.md", "embedding": embedding}


def test_top_k_ranks_by_similarity_descending():
    query = np.array([1.0, 0.0])
    indexed = [
        _chunk("far", [-1.0, 0.0]),
        _chunk("close", [0.9, 0.1]),
        _chunk("exact", [1.0, 0.0]),
    ]

    results = top_k(query, indexed, k=3)

    assert [r.text for r in results] == ["exact", "close", "far"]
    assert results[0].score >= results[1].score >= results[2].score


def test_top_k_respects_the_limit():
    query = np.array([1.0, 0.0])
    indexed = [_chunk(str(i), [1.0, 0.0]) for i in range(10)]

    results = top_k(query, indexed, k=3)

    assert len(results) == 3


def test_top_k_of_empty_index_returns_empty_list():
    assert top_k(np.array([1.0, 0.0]), [], k=4) == []
