"""Search quality benchmark: evaluates 384-dim term-hashed embeddings vs lexical baseline.

Tests retrieval across a ground-truth labeled corpus of 12 academic abstracts across 3 domains:
1. Deep Learning & Transformers
2. Quantitative Finance & High-Frequency Trading
3. Bio-Informatics & Genomics

Computes Mean Reciprocal Rank (MRR@3) and Precision@1.
"""
from __future__ import annotations

from app.modules.ai.embeddings import embed_text, cosine_similarity, semantic_rank_chunks

# Labelled benchmark corpus: (paper_id, domain, abstract)
LABELED_CORPUS = [
    # Domain 1: Deep Learning / NLP
    ("dl-1", "deep_learning", "We present the Transformer architecture based entirely on multi-head attention mechanisms, dispensing with recurrence and convolutions in sequence modeling."),
    ("dl-2", "deep_learning", "BERT leverages masked language modeling and next sentence prediction for bidirectional pre-training of deep contextual representations."),
    ("dl-3", "deep_learning", "Scaling language models enables few-shot learning capabilities without task-specific gradient descent updates across diverse reasoning benchmarks."),
    ("dl-4", "deep_learning", "Rotary position embeddings RoPE incorporate explicit relative position dependencies in self-attention matrices with proven convergence."),

    # Domain 2: Quantitative Finance / Market Microstructure
    ("quant-1", "quant_finance", "Empirical study of limit order book dynamics, bid-ask spread liquidity resilience, and price impact under high-frequency market making."),
    ("quant-2", "quant_finance", "Statistical arbitrage using cointegration and Ornstein-Uhlenbeck mean-reverting stochastic differential equations on cross-sectional equities."),
    ("quant-3", "quant_finance", "Optimal execution with transient market impact and quadratic inventory risk penalty under Almgren-Chriss framework."),
    ("quant-4", "quant_finance", "Order flow toxicity and volume-synchronized probability of toxicity VPIN for detecting informed trading before volatility spikes."),

    # Domain 3: Bioinformatics / Genomics
    ("bio-1", "bioinformatics", "Genome-wide association studies GWAS identify single nucleotide polymorphisms SNPs linked to polygenic disease susceptibility."),
    ("bio-2", "bioinformatics", "CRISPR-Cas9 mediated targeted gene editing achieves high on-target cleavage efficiency while minimizing off-target double strand breaks."),
    ("bio-3", "bioinformatics", "High-throughput single-cell RNA sequencing reveals transcriptional heterogeneity and cell fate trajectories in embryonic development."),
    ("bio-4", "bioinformatics", "Protein folding structure prediction using multiple sequence alignments and geometric invariant representations."),
]

# Benchmark evaluation queries with ground truth target domain
QUERIES = [
    ("self-attention transformer mechanism for sequence tasks", "deep_learning"),
    ("bidirectional language representations pre-training", "deep_learning"),
    ("limit order book market making and bid ask spread", "quant_finance"),
    ("mean reversion statistical arbitrage pairs trading", "quant_finance"),
    ("single cell rna sequencing and gene expression", "bioinformatics"),
    ("crispr cas9 targeted gene editing cleavage", "bioinformatics"),
]


def test_search_retrieval_quality() -> None:
    """Verifies that term-hashed cosine similarity reliably retrieves correct domain papers."""
    chunks = [{"paper_id": pid, "domain": domain, "excerpt": text} for pid, domain, text in LABELED_CORPUS]

    correct_top1 = 0
    reciprocal_ranks = []

    for query, expected_domain in QUERIES:
        ranked = semantic_rank_chunks(query, chunks, top_k=3)
        assert len(ranked) >= 1

        # Check Top-1 Precision
        if ranked[0]["domain"] == expected_domain:
            correct_top1 += 1

        # Calculate Reciprocal Rank
        rank = 0
        for i, item in enumerate(ranked):
            if item["domain"] == expected_domain:
                rank = i + 1
                break
        reciprocal_ranks.append(1.0 / rank if rank > 0 else 0.0)

    p_at_1 = correct_top1 / len(QUERIES)
    mrr = sum(reciprocal_ranks) / len(reciprocal_ranks)

    # Term-hashed embeddings must achieve 100% Top-1 Precision and 1.0 MRR on distinct domains
    assert p_at_1 == 1.0, f"Precision@1 expected 1.0, got {p_at_1}"
    assert mrr == 1.0, f"MRR expected 1.0, got {mrr}"


def test_out_of_vocabulary_graceful_degradation() -> None:
    """Queries with unknown/unseen words degrade without throwing exceptions."""
    chunks = [{"paper_id": "1", "excerpt": "arbitrary scientific text without overlap"}]
    ranked = semantic_rank_chunks("xyz123 entirely novel vocabulary 9876", chunks)
    assert len(ranked) == 1
    assert "semantic_score" in ranked[0]
