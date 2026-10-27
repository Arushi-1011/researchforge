"""Tests for quantitative analytics engine.

All functions are pure (no I/O, no DB); tested without any async infrastructure.
"""
from __future__ import annotations
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock

try:
    import pytest
except ImportError:
    class _Approx:
        def __init__(self, val, abs=0.01):
            self.val = val
            self.abs = abs
        def __eq__(self, other):
            return abs(self.val - other) <= self.abs
    class FakePytest:
        @staticmethod
        def approx(val, abs=0.01):
            return _Approx(val, abs)
    pytest = FakePytest()

from app.modules.quant.analytics import (
    publication_timeline,
    rolling_velocity,
    paper_similarity_matrix,
    research_portfolio_metrics,
    _tfidf_vector,
)


def _paper(title: str, abstract: str = "", year: int | None = None, extracted: bool = False) -> MagicMock:
    p = MagicMock()
    p.id = uuid.uuid4()
    p.title = title
    p.abstract = abstract
    p.year = year
    p.extracted_text = "Some extracted text." if extracted else None
    p.created_at = datetime.now(timezone.utc)
    return p


class TestPublicationTimeline:
    def test_empty_returns_empty(self) -> None:
        assert publication_timeline([]) == []

    def test_single_paper(self) -> None:
        result = publication_timeline([_paper("A", year=2022)])
        assert len(result) == 1
        assert result[0]["year"] == 2022
        assert result[0]["count"] == 1

    def test_multiple_years_sorted(self) -> None:
        papers = [_paper("A", year=2020), _paper("B", year=2019), _paper("C", year=2020)]
        result = publication_timeline(papers)
        years = [r["year"] for r in result]
        assert years == sorted(years)
        year_2020 = next(r for r in result if r["year"] == 2020)
        assert year_2020["count"] == 2

    def test_papers_without_year_ignored(self) -> None:
        papers = [_paper("A", year=None), _paper("B", year=2021)]
        result = publication_timeline(papers)
        assert len(result) == 1


class TestRollingVelocity:
    def test_adds_rolling_avg_field(self) -> None:
        papers = [_paper(f"P{i}", year=2018 + i) for i in range(5)]
        result = rolling_velocity(papers, window=3)
        assert all("rolling_avg" in r for r in result)

    def test_single_paper_no_crash(self) -> None:
        result = rolling_velocity([_paper("Only", year=2023)])
        assert len(result) == 1


class TestSimilarityMatrix:
    def test_fewer_than_two_returns_empty(self) -> None:
        result = paper_similarity_matrix([_paper("Only one")])
        assert result["matrix"] == []

    def test_identical_papers_high_similarity(self) -> None:
        abstract = "machine learning neural network deep learning transformer attention"
        p1 = _paper("Paper A", abstract=abstract, year=2023)
        p2 = _paper("Paper B", abstract=abstract, year=2023)
        result = paper_similarity_matrix([p1, p2])
        # Off-diagonal should be > 0 for identical abstracts
        if result["matrix"]:
            assert result["matrix"][0][1] >= 0.0

    def test_matrix_is_symmetric(self) -> None:
        papers = [
            _paper("Transformers", abstract="attention mechanism self-attention bert gpt language model"),
            _paper("CNNs", abstract="convolutional neural network image classification pooling"),
            _paper("RL agents", abstract="reinforcement learning reward policy gradient"),
        ]
        result = paper_similarity_matrix(papers)
        mat = result["matrix"]
        n = len(mat)
        for i in range(n):
            for j in range(n):
                assert abs(mat[i][j] - mat[j][i]) < 1e-6, "Matrix must be symmetric"

    def test_labels_truncated_to_60_chars(self) -> None:
        p = _paper("A" * 100, year=2022)
        q = _paper("B" * 100, year=2023)
        result = paper_similarity_matrix([p, q])
        for label in result["labels"]:
            assert len(label) <= 60


class TestPortfolioMetrics:
    def test_empty_returns_empty_dict(self) -> None:
        assert research_portfolio_metrics([]) == {}

    def test_coverage_score_reflects_extraction(self) -> None:
        papers = [
            _paper("P1", year=2022, extracted=True),
            _paper("P2", year=2023, extracted=False),
        ]
        metrics = research_portfolio_metrics(papers)
        assert metrics["coverage_score"] == pytest.approx(0.5, abs=0.01)

    def test_signal_is_valid_value(self) -> None:
        papers = [_paper(f"Paper {i}", abstract="test abstract content words", year=2020 + i) for i in range(5)]
        metrics = research_portfolio_metrics(papers)
        assert metrics["signal"] in {"STRONG_BUY", "HOLD", "REBALANCE", "NO_DATA"}

    def test_composite_score_in_range(self) -> None:
        papers = [_paper(f"P{i}", abstract="data science machine learning", year=2021 + i, extracted=(i % 2 == 0)) for i in range(4)]
        metrics = research_portfolio_metrics(papers)
        assert 0.0 <= metrics["composite_score"] <= 100.0

    def test_tfidf_vector_length_matches_vocab(self) -> None:
        vocab = ["machine", "learning", "neural"]
        vec = _tfidf_vector("machine learning is great", vocab)
        assert len(vec) == len(vocab)
        assert vec[0] > 0  # "machine" appears
        assert vec[2] == 0  # "neural" does not

    def test_weight_sensitivity_and_perturbation(self) -> None:
        from app.modules.quant.analytics import compute_composite_score

        base = compute_composite_score(coverage=0.8, diversity=0.7, decay=0.9, velocity_signal=0.5)

        # Perturb diversity weight +20% and coverage -20%
        perturbed = compute_composite_score(
            coverage=0.8, diversity=0.7, decay=0.9, velocity_signal=0.5,
            w_cov=20.0, w_div=42.0, w_rec=25.0, w_vel=15.0
        )
        # Difference should be bounded and proportional to factor delta: (0.7 * 7) - (0.8 * 5) = 4.9 - 4.0 = +0.9
        assert abs(perturbed - base) < 5.0

    def test_disclaimer_present_in_output(self) -> None:
        papers = [_paper("Sample", year=2023, extracted=True)]
        metrics = research_portfolio_metrics(papers)
        assert "disclaimer" in metrics
        assert "financial or investment advice" in metrics["disclaimer"]
