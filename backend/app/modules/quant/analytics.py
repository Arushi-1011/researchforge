"""Quantitative analytics engine for research portfolio analysis.

Treats paper collections as research "portfolios" and applies financial signal
processing techniques to surface publication trends, paper similarity, and
research momentum metrics.
"""
from __future__ import annotations

import math
import re
from collections import Counter
from datetime import datetime, timezone
from typing import Any, TYPE_CHECKING

# numpy and pandas are installed in the Docker container via pyproject.toml additions
# For local fallback we handle ImportError gracefully
try:
    import numpy as np
    import pandas as pd
    HAS_NUMPY = True
except ImportError:  # pragma: no cover
    HAS_NUMPY = False

if TYPE_CHECKING:
    from app.modules.library.models import LibraryPaper
else:
    LibraryPaper = Any


# ---------------------------------------------------------------------------
# Time-series: publication velocity
# ---------------------------------------------------------------------------

def publication_timeline(papers: list[LibraryPaper]) -> list[dict[str, Any]]:
    """Compute monthly publication counts as a time-series.
    
    Analogous to a bar chart of trade volume over time — useful for spotting
    research momentum and acceleration in a field.
    """
    if not papers:
        return []

    # Build (year, month) → count map
    counts: Counter[tuple[int, int]] = Counter()
    for p in papers:
        if p.year:
            counts[(p.year, 1)] += 1  # granularity: annual (month=1 as placeholder)

    if not counts:
        return []

    sorted_periods = sorted(counts.keys())
    return [
        {
            "period": f"{y}",
            "year": y,
            "count": counts[(y, m)],
        }
        for y, m in sorted_periods
    ]


def rolling_velocity(
    papers: list[LibraryPaper], window: int = 3
) -> list[dict[str, Any]]:
    """Compute rolling-window average publication rate (momentum indicator).
    
    Equivalent to a moving-average crossover in financial time-series — a
    rising rolling velocity signals accelerating research activity.
    """
    timeline = publication_timeline(papers)
    if len(timeline) < 2:
        return timeline

    if HAS_NUMPY:
        counts = np.array([t["count"] for t in timeline], dtype=float)
        # Centered rolling mean with min_periods=1
        series = pd.Series(counts)
        rolling = series.rolling(window=window, min_periods=1, center=True).mean()
        for i, entry in enumerate(timeline):
            entry["rolling_avg"] = round(float(rolling.iloc[i]), 3)
    else:
        for entry in timeline:
            entry["rolling_avg"] = float(entry["count"])

    return timeline


# ---------------------------------------------------------------------------
# Similarity matrix (correlation-matrix equivalent)
# ---------------------------------------------------------------------------

def _tfidf_vector(text: str, vocab: list[str]) -> list[float]:
    """Compute a simple TF-IDF vector for one document against a shared vocab."""
    tokens = re.findall(r"[a-z]{3,}", text.lower())
    tf: Counter[str] = Counter(tokens)
    total = max(len(tokens), 1)
    vec = [tf.get(term, 0) / total for term in vocab]
    return vec


def paper_similarity_matrix(papers: list[LibraryPaper]) -> dict[str, Any]:
    """Compute pairwise cosine-similarity matrix across papers.
    
    Analogous to a correlation matrix in portfolio construction — identifies
    redundant (highly correlated) papers and truly novel (uncorrelated) additions.
    Returns a symmetric matrix with paper titles as labels.
    """
    if len(papers) < 2:
        return {"labels": [], "matrix": [], "insights": []}

    # Build vocab from all abstracts + titles
    corpus = [
        ((p.abstract or "") + " " + p.title).lower()
        for p in papers
    ]
    all_tokens = re.findall(r"[a-z]{4,}", " ".join(corpus))
    # Top-300 terms by frequency (document frequency weighted)
    doc_freq: Counter[str] = Counter()
    for doc in corpus:
        for term in set(re.findall(r"[a-z]{4,}", doc)):
            doc_freq[term] += 1
    # IDF-weight: prefer terms in 1-3 docs (discriminative)
    vocab = [
        term for term, df in doc_freq.most_common(500)
        if 1 <= df <= max(2, len(papers) // 2)
    ][:300]
    if not vocab:
        vocab = list(set(all_tokens))[:300]

    if HAS_NUMPY:
        vectors = np.array([_tfidf_vector(doc, vocab) for doc in corpus])
        # L2 normalize
        norms = np.linalg.norm(vectors, axis=1, keepdims=True)
        norms = np.where(norms == 0, 1, norms)
        unit = vectors / norms
        sim_matrix = unit @ unit.T
        matrix = [[round(float(v), 4) for v in row] for row in sim_matrix.tolist()]
    else:
        n = len(papers)
        matrix = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]

    labels = [p.title[:60] for p in papers]

    # Summarise: find most and least similar pairs
    insights: list[str] = []
    n = len(papers)
    if HAS_NUMPY and n >= 2:
        sim_arr = np.array(matrix)
        # Mask diagonal
        np.fill_diagonal(sim_arr, -1.0)
        idx = int(np.argmax(sim_arr))
        r, c = divmod(idx, n)
        insights.append(
            f"Most similar: '{papers[r].title[:40]}' \u2194 '{papers[c].title[:40]}' "
            f"(score {matrix[r][c]:.3f}) \u2014 consider deduplication."
        )
        np.fill_diagonal(sim_arr, 2.0)
        idx2 = int(np.argmin(sim_arr))
        r2, c2 = divmod(idx2, n)
        insights.append(
            f"Most distinct: '{papers[r2].title[:40]}' \u2194 '{papers[c2].title[:40]}' "
            f"(score {matrix[r2][c2]:.3f}) \u2014 high portfolio diversity here."
        )

    return {
        "labels": labels,
        "matrix": matrix,
        "insights": insights,
    }


# ---------------------------------------------------------------------------
# Portfolio metrics
# ---------------------------------------------------------------------------

def _diversity_score(matrix_data: dict[str, Any]) -> float:
    """Compute average off-diagonal similarity — lower = more diverse portfolio."""
    mat = matrix_data.get("matrix", [])
    n = len(mat)
    if n < 2:
        return 0.0
    if HAS_NUMPY:
        arr = np.array(mat, dtype=float)
        mask = ~np.eye(n, dtype=bool)
        return float(round(1.0 - arr[mask].mean(), 4))
    return 0.5


# Factor weighting rationale:
# - Coverage (25%): Verifies extracted PDF text exists for downstream evidence synthesis.
# - Diversity (35%): Highest weight to penalize redundant, echo-chamber reading lists and reward topic breadth.
# - Recency (25%): Exponential decay (5-year half-life) prioritizing active state-of-the-art literature.
# - Velocity (15%): Secondary signal measuring recent publication acceleration.
WEIGHT_COVERAGE = 25.0
WEIGHT_DIVERSITY = 35.0
WEIGHT_RECENCY = 25.0
WEIGHT_VELOCITY = 15.0

PORTFOLIO_DISCLAIMER = (
    "Research portfolio signals (STRONG_BUY, HOLD, REBALANCE) are heuristic indicators "
    "evaluating literature collection health and bibliographic diversity. "
    "They are metaphorical and do not constitute financial or investment advice."
)


def compute_composite_score(
    coverage: float,
    diversity: float,
    decay: float,
    velocity_signal: float,
    w_cov: float = WEIGHT_COVERAGE,
    w_div: float = WEIGHT_DIVERSITY,
    w_rec: float = WEIGHT_RECENCY,
    w_vel: float = WEIGHT_VELOCITY,
) -> float:
    """Compute weighted composite score from normalized factors."""
    norm_velocity = min(max((velocity_signal + 2.0) / 4.0, 0.0), 1.0)
    score = (
        (coverage * w_cov)
        + (diversity * w_div)
        + (min(decay, 1.0) * w_rec)
        + (norm_velocity * w_vel)
    )
    return round(float(score), 1)


def research_portfolio_metrics(papers: list[LibraryPaper]) -> dict[str, Any]:
    """Aggregate research-quality metrics in the style of a portfolio risk report.
    
    Metrics:
    - coverage_score: fraction of papers with extracted PDF text (data completeness)
    - diversity_score: 1 - avg_pairwise_similarity (higher = more diverse set)
    - recency_weight: exponential decay weighting toward recent papers
    - velocity_signal: z-score of latest publication count vs rolling mean
    - recommended_action: qualitative signal analogous to buy/hold/sell
    """
    if not papers:
        return {}

    n = len(papers)
    current_year = datetime.now(timezone.utc).year

    # Coverage: fraction with full text
    coverage = sum(1 for p in papers if p.extracted_text) / n

    # Year distribution statistics
    years = [p.year for p in papers if p.year]
    if years and HAS_NUMPY:
        year_arr = np.array(years, dtype=float)
        mean_year = float(np.mean(year_arr))
        std_year = float(np.std(year_arr))
        # Recency weight: exponential decay, half-life = 5 years
        half_life = 5.0
        decay = float(np.mean(np.exp(-np.log(2) * (current_year - year_arr) / half_life)))
    elif years:
        mean_year = sum(years) / len(years)
        std_year = math.sqrt(sum((y - mean_year) ** 2 for y in years) / len(years))
        decay = sum(math.exp(-math.log(2) * (current_year - y) / 5.0) for y in years) / len(years)
    else:
        mean_year = float(current_year)
        std_year = 0.0
        decay = 1.0

    # Velocity signal
    timeline = rolling_velocity(papers)
    velocity_signal = 0.0
    if len(timeline) >= 2 and HAS_NUMPY:
        counts = np.array([t["count"] for t in timeline], dtype=float)
        rolling_avgs = np.array([t.get("rolling_avg", t["count"]) for t in timeline], dtype=float)
        latest_count = counts[-1]
        latest_avg = rolling_avgs[-1]
        sigma = float(np.std(counts)) or 1.0
        velocity_signal = round((latest_count - latest_avg) / sigma, 3)

    # Similarity matrix for diversity
    sim_data = paper_similarity_matrix(papers)
    diversity = _diversity_score(sim_data)

    # Composite score (0-100) using justified factor weights
    composite = compute_composite_score(coverage, diversity, decay, velocity_signal)

    # Qualitative research health signal
    if composite >= 70:
        signal = "STRONG_BUY"
        rationale = "High text coverage, diverse papers, and recent momentum — this research portfolio is well-constructed."
    elif composite >= 50:
        signal = "HOLD"
        rationale = "Moderate diversity or coverage gaps. Consider adding papers from underrepresented years or topics."
    else:
        signal = "REBALANCE"
        rationale = "Low diversity or poor text coverage. Extract PDFs or broaden topic scope."

    return {
        "paper_count": n,
        "coverage_score": round(coverage, 3),
        "diversity_score": round(diversity, 3),
        "recency_decay": round(decay, 3),
        "mean_publication_year": round(mean_year, 1),
        "publication_year_std": round(std_year, 2),
        "velocity_signal": velocity_signal,
        "composite_score": composite,
        "signal": signal,
        "rationale": rationale,
        "disclaimer": PORTFOLIO_DISCLAIMER,
        "numpy_available": HAS_NUMPY,
    }
