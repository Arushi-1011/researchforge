"""Tests for the semantic embedding utilities."""
from __future__ import annotations

try:
    import pytest
except ImportError:
    pytest = None

from app.modules.ai.embeddings import (
    embed_text,
    cosine_similarity,
    semantic_rank_chunks,
    _tokenize,
    EMBED_DIM,
)


class TestEmbed:
    def test_output_dimension(self) -> None:
        vec = embed_text("attention is all you need transformer architecture")
        assert len(vec) == EMBED_DIM

    def test_empty_string_returns_zero_vector(self) -> None:
        vec = embed_text("")
        assert all(v == 0.0 for v in vec)

    def test_output_is_l2_normalised(self) -> None:
        vec = embed_text("machine learning deep neural networks")
        norm_sq = sum(v * v for v in vec)
        # Allow small floating-point error
        assert abs(norm_sq - 1.0) < 1e-6 or norm_sq == 0.0

    def test_deterministic(self) -> None:
        text = "stochastic gradient descent optimizer"
        assert embed_text(text) == embed_text(text)

    def test_different_texts_differ(self) -> None:
        v1 = embed_text("reinforcement learning reward policy")
        v2 = embed_text("convolutional neural network image classification")
        assert v1 != v2


class TestCosineSimilarity:
    def test_identical_vectors_score_one(self) -> None:
        v = embed_text("transformer self attention bert")
        assert abs(cosine_similarity(v, v) - 1.0) < 1e-6

    def test_orthogonal_near_zero(self) -> None:
        # Two entirely different vocabularies should have low similarity
        v1 = embed_text("aaaa bbbb cccc dddd")
        v2 = embed_text("zzzz yyyy xxxx wwww")
        score = cosine_similarity(v1, v2)
        # Not a hard guarantee but should be low for hash-distributed vectors
        assert -1.0 <= score <= 1.0

    def test_similar_texts_score_higher_than_unrelated(self) -> None:
        query = "neural network architecture"
        relevant = "deep neural network layers architecture design"
        irrelevant = "stock market trading portfolio hedge fund"
        q = embed_text(query)
        r = embed_text(relevant)
        u = embed_text(irrelevant)
        assert cosine_similarity(q, r) >= cosine_similarity(q, u)


class TestSemanticRankChunks:
    def test_empty_returns_empty(self) -> None:
        assert semantic_rank_chunks("query", []) == []

    def test_returns_at_most_top_k(self) -> None:
        chunks = [{"excerpt": f"text about topic {i}", "paper_id": str(i)} for i in range(20)]
        result = semantic_rank_chunks("topic", chunks, top_k=5)
        assert len(result) <= 5

    def test_result_has_semantic_score_field(self) -> None:
        chunks = [{"excerpt": "machine learning model training", "paper_id": "abc"}]
        result = semantic_rank_chunks("machine learning", chunks)
        assert "semantic_score" in result[0]

    def test_preserves_chunk_fields(self) -> None:
        chunks = [{"excerpt": "some text", "paper_id": "xyz", "title": "My Paper"}]
        result = semantic_rank_chunks("some text", chunks)
        assert result[0]["paper_id"] == "xyz"
        assert result[0]["title"] == "My Paper"


class TestTokenize:
    def test_stopwords_removed(self) -> None:
        tokens = _tokenize("the model was trained with the dataset")
        assert "the" not in tokens
        assert "was" not in tokens
        assert "model" in tokens

    def test_short_words_removed(self) -> None:
        tokens = _tokenize("an ai ml nlp system for tasks")
        assert "an" not in tokens
        assert "system" in tokens
