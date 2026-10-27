"""Research portfolio quantitative analytics endpoints.

Applies financial signal-processing techniques (rolling velocity, cosine-similarity
matrices, portfolio scoring) to the paper collection in a project. No LLM is
involved — all computations are deterministic and reproducible.
"""
from __future__ import annotations
import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.deps import get_current_user, get_project_for_member
from app.modules.users.models import User
from app.modules.library.models import LibraryPaper
from app.modules.quant.analytics import (
    rolling_velocity,
    paper_similarity_matrix,
    research_portfolio_metrics,
)
from app.modules.quant.schemas import AnalyticsReport, SimilarityMatrix, TimelinePoint, PortfolioMetrics

router = APIRouter(prefix="/projects/{project_id}/analytics", tags=["quant-analytics"])


async def _load_papers(project_id: uuid.UUID, db: AsyncSession) -> list[LibraryPaper]:
    rows = await db.execute(
        select(LibraryPaper)
        .where(LibraryPaper.project_id == project_id)
        .order_by(LibraryPaper.created_at)
    )
    return list(rows.scalars().all())


@router.get("", response_model=AnalyticsReport)
async def full_analytics(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> AnalyticsReport:
    """Return a full quantitative analytics report for the project's paper library.
    
    Equivalent to a portfolio risk report: publication time-series, pairwise
    similarity matrix, and composite portfolio health metrics.
    """
    await get_project_for_member(project_id, user, db)
    papers = await _load_papers(project_id, db)

    timeline_raw = rolling_velocity(papers)
    timeline = [TimelinePoint(**t) for t in timeline_raw]

    sim_raw = paper_similarity_matrix(papers)
    similarity = SimilarityMatrix(**sim_raw)

    portfolio_raw = research_portfolio_metrics(papers)
    if not portfolio_raw:
        portfolio_raw = {
            "paper_count": 0, "coverage_score": 0.0, "diversity_score": 0.0,
            "recency_decay": 0.0, "mean_publication_year": 0.0, "publication_year_std": 0.0,
            "velocity_signal": 0.0, "composite_score": 0.0, "signal": "NO_DATA",
            "rationale": "Add papers to this project to generate analytics.",
            "numpy_available": False,
        }
    portfolio = PortfolioMetrics(**portfolio_raw)

    return AnalyticsReport(
        project_id=str(project_id),
        timeline=timeline,
        similarity=similarity,
        portfolio=portfolio,
    )


@router.get("/timeline", response_model=list[TimelinePoint])
async def timeline_endpoint(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[TimelinePoint]:
    """Publication time-series with rolling-window velocity (momentum signal)."""
    await get_project_for_member(project_id, user, db)
    papers = await _load_papers(project_id, db)
    return [TimelinePoint(**t) for t in rolling_velocity(papers)]


@router.get("/similarity", response_model=SimilarityMatrix)
async def similarity_endpoint(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> SimilarityMatrix:
    """Pairwise paper cosine-similarity matrix (portfolio correlation equivalent)."""
    await get_project_for_member(project_id, user, db)
    papers = await _load_papers(project_id, db)
    return SimilarityMatrix(**paper_similarity_matrix(papers))


@router.get("/portfolio", response_model=PortfolioMetrics)
async def portfolio_endpoint(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> PortfolioMetrics:
    """Composite research portfolio health score with buy/hold/rebalance signal."""
    await get_project_for_member(project_id, user, db)
    papers = await _load_papers(project_id, db)
    raw = research_portfolio_metrics(papers)
    if not raw:
        raw = {
            "paper_count": 0, "coverage_score": 0.0, "diversity_score": 0.0,
            "recency_decay": 0.0, "mean_publication_year": 0.0, "publication_year_std": 0.0,
            "velocity_signal": 0.0, "composite_score": 0.0, "signal": "NO_DATA",
            "rationale": "Add papers to this project to generate analytics.",
            "numpy_available": False,
        }
    return PortfolioMetrics(**raw)
