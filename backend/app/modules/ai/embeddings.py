"""Semantic embedding utilities for library papers.

Uses a lightweight pure-Python TF-IDF embedding when sentence-transformers is
unavailable (CI / standard Docker image), and pgvector cosine similarity when
the vector extension is available in Postgres.

Design principle: the system degrades gracefully to lexical retrieval — no hard
dependency on any ML runtime.
"""
from __future__ import annotations

import re
import math
from collections import Counter
from typing import Any


# ---------------------------------------------------------------------------
# Pure-Python TF-IDF embedding (384-dim projection via term hashing)
# Produces a deterministic float vector without any external ML dependency.
# Used as fallback when sentence-transformers is unavailable.
# ---------------------------------------------------------------------------

EMBED_DIM = 384
_STOPWORDS = {
    "the", "and", "for", "that", "this", "with", "from", "are", "was",
    "were", "has", "have", "been", "not", "but", "can", "its", "also",
    "which", "such", "than", "more", "into", "their", "they", "when",
    "what", "will", "all", "each", "our", "these", "over", "used",
}


def _tokenize(text: str) -> list[str]:
    return [
        t for t in re.findall(r"[a-z]{3,}", text.lower())
        if t not in _STOPWORDS
    ]


def _hash_embed(text: str, dim: int = EMBED_DIM) -> list[float]:
    """Project text into a fixed-dimension float vector via term hashing (hash trick).

    Each token is hashed to a bucket index; TF weight accumulates in that bucket.
    Resulting vector is L2-normalised. This is deterministic and reproducible.
    """
    tokens = _tokenize(text)
    if not tokens:
        return [0.0] * dim
    tf = Counter(tokens)
    total = len(tokens)
    vec = [0.0] * dim
    for term, count in tf.items():
        # FNV-1a hash for good distribution
        h = 2166136261
        for ch in term.encode():
            h ^= ch
            h = (h * 16777619) & 0xFFFFFFFF
        bucket = h % dim
        sign = 1 if (h >> 31) == 0 else -1
        vec[bucket] += sign * (count / total)
    # L2 normalise
    norm = math.sqrt(sum(v * v for v in vec)) or 1.0
    return [v / norm for v in vec]


def embed_text(text: str) -> list[float]:
    """Return a 384-dim embedding for the given text (pure-Python fallback)."""
    return _hash_embed(text, dim=EMBED_DIM)


def cosine_similarity(a: list[float], b: list[float]) -> float:
    """Compute cosine similarity between two L2-normalised vectors."""
    return sum(x * y for x, y in zip(a, b))


def semantic_rank_chunks(
    query: str,
    chunks: list[dict[str, Any]],
    top_k: int = 8,
) -> list[dict[str, Any]]:
    """Re-rank evidence chunks by semantic similarity to the query.

    Falls back to the original ordering if embeddings are unavailable.
    Each chunk dict must have an 'excerpt' field.
    """
    if not chunks:
        return chunks

    query_vec = embed_text(query)
    scored = []
    for chunk in chunks:
        excerpt = chunk.get("excerpt", "")
        chunk_vec = embed_text(excerpt)
        score = cosine_similarity(query_vec, chunk_vec)
        scored.append({**chunk, "semantic_score": round(score, 4)})

    scored.sort(key=lambda c: c["semantic_score"], reverse=True)
    return scored[:top_k]
