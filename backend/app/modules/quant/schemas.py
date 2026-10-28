"""Pydantic schemas for quantitative analytics responses."""
from __future__ import annotations
from typing import Any
from pydantic import BaseModel


class TimelinePoint(BaseModel):
    period: str
    year: int
    count: int
    rolling_avg: float = 0.0


class SimilarityMatrix(BaseModel):
    labels: list[str]
    matrix: list[list[float]]
    insights: list[str] = []


class PortfolioMetrics(BaseModel):
    paper_count: int
    coverage_score: float
    diversity_score: float
    recency_decay: float
    mean_publication_year: float
    publication_year_std: float
    velocity_signal: float
    composite_score: float
    signal: str
    rationale: str
    numpy_available: bool
    disclaimer: str = ""


class AnalyticsReport(BaseModel):
    project_id: str
    timeline: list[TimelinePoint]
    similarity: SimilarityMatrix
    portfolio: PortfolioMetrics
