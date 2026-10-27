"""Project-scoped comparisons, comparison matrix, and research-gap notes. No AI calls."""
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.deps import get_current_user, get_project_for_member, require_editor
from app.modules.users.models import User
from app.modules.library.models import LibraryPaper
from app.modules.analysis.models import Comparison, ComparisonPaper, ResearchGap
from app.modules.analysis.schemas import ComparisonCreate, GapCreate, GapUpdate

router = APIRouter(prefix="/projects/{project_id}", tags=["compare-and-gaps"])


def gap_out(gap: ResearchGap) -> dict:
    return {"id": str(gap.id), "project_id": str(gap.project_id), "comparison_id": str(gap.comparison_id) if gap.comparison_id else None,
            "note": gap.note, "status": gap.status, "origin": gap.origin, "created_by": str(gap.created_by),
            "created_at": gap.created_at.isoformat()}


async def get_comparison(project_id: uuid.UUID, comparison_id: uuid.UUID, db: AsyncSession) -> Comparison:
    comparison = (await db.execute(select(Comparison).where(
        Comparison.id == comparison_id, Comparison.project_id == project_id
    ))).scalar_one_or_none()
    if comparison is None:
        raise HTTPException(404, "Comparison not found")
    return comparison


@router.post("/comparisons", status_code=201)
async def create_comparison(project_id: uuid.UUID, data: ComparisonCreate,
                            db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Save a comparison of at least two papers from this project."""
    await require_editor(project_id, user, db)
    papers = (await db.execute(select(LibraryPaper).where(
        LibraryPaper.project_id == project_id, LibraryPaper.id.in_(data.paper_ids)
    ))).scalars().all()
    if len(papers) != len(data.paper_ids):
        raise HTTPException(422, "Every selected paper must belong to this project's library")
    comparison = Comparison(project_id=project_id, title=data.title, created_by=user.id)
    db.add(comparison)
    await db.flush()
    for position, paper_id in enumerate(data.paper_ids):
        db.add(ComparisonPaper(comparison_id=comparison.id, paper_id=paper_id, position=position))
    await db.commit()
    return {"id": str(comparison.id), "project_id": str(project_id), "title": comparison.title,
            "paper_ids": [str(paper_id) for paper_id in data.paper_ids], "created_at": comparison.created_at.isoformat()}


@router.get("/comparisons")
async def list_comparisons(project_id: uuid.UUID, limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
                           db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    await get_project_for_member(project_id, user, db)
    comparisons = (await db.execute(select(Comparison).where(Comparison.project_id == project_id)
                                    .order_by(Comparison.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    output = []
    for comparison in comparisons:
        ids = (await db.execute(select(ComparisonPaper.paper_id).where(
            ComparisonPaper.comparison_id == comparison.id).order_by(ComparisonPaper.position))).scalars().all()
        output.append({"id": str(comparison.id), "project_id": str(project_id), "title": comparison.title,
                       "paper_ids": [str(paper_id) for paper_id in ids], "created_at": comparison.created_at.isoformat()})
    return output


@router.get("/comparisons/{comparison_id}")
async def comparison_matrix(project_id: uuid.UUID, comparison_id: uuid.UUID,
                            db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    """Return a deterministic, data-backed matrix; missing fields remain empty, never inferred."""
    await get_project_for_member(project_id, user, db)
    comparison = await get_comparison(project_id, comparison_id, db)
    rows = await db.execute(select(LibraryPaper).join(ComparisonPaper, ComparisonPaper.paper_id == LibraryPaper.id)
                            .where(ComparisonPaper.comparison_id == comparison.id)
                            .order_by(ComparisonPaper.position))
    papers = rows.scalars().all()
    if len(papers) < 2:
        raise HTTPException(409, "A comparison must contain at least two papers")
    fields = ["title", "authors", "year", "abstract", "doi", "source", "extraction_status", "page_count"]
    matrix = []
    for field in fields:
        values = []
        for paper in papers:
            value = getattr(paper, field, None)
            if field == "authors":
                value = [name for name in (value or "").split("\n") if name]
            values.append({"paper_id": str(paper.id), "value": value})
        matrix.append({"field": field, "values": values})
    return {"id": str(comparison.id), "project_id": str(project_id), "title": comparison.title,
            "papers": [{"id": str(p.id), "title": p.title} for p in papers], "matrix": matrix,
            "note": "Values are shown from stored paper metadata; empty fields are not inferred."}


@router.delete("/comparisons/{comparison_id}", status_code=204)
async def delete_comparison(project_id: uuid.UUID, comparison_id: uuid.UUID,
                            db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    await require_editor(project_id, user, db)
    comparison = await get_comparison(project_id, comparison_id, db)
    await db.delete(comparison)
    await db.commit()


@router.post("/gaps", status_code=201)
async def create_gap(project_id: uuid.UUID, data: GapCreate,
                     db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await require_editor(project_id, user, db)
    if data.comparison_id is not None:
        await get_comparison(project_id, data.comparison_id, db)
    gap = ResearchGap(project_id=project_id, comparison_id=data.comparison_id, note=data.note,
                      status="OPEN", origin="USER", created_by=user.id)
    db.add(gap)
    await db.commit()
    await db.refresh(gap)
    return gap_out(gap)


@router.get("/gaps")
async def list_gaps(project_id: uuid.UUID, status: str | None = Query(default=None, pattern="^(OPEN|ADDRESSED)$"),
                    limit: int = Query(default=50, ge=1, le=100), offset: int = Query(default=0, ge=0),
                    db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    await get_project_for_member(project_id, user, db)
    query = select(ResearchGap).where(ResearchGap.project_id == project_id)
    if status:
        query = query.where(ResearchGap.status == status)
    gaps = (await db.execute(query.order_by(ResearchGap.created_at.desc()).limit(limit).offset(offset))).scalars().all()
    return [gap_out(gap) for gap in gaps]


@router.patch("/gaps/{gap_id}")
async def update_gap(project_id: uuid.UUID, gap_id: uuid.UUID, data: GapUpdate,
                     db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await require_editor(project_id, user, db)
    gap = (await db.execute(select(ResearchGap).where(
        ResearchGap.id == gap_id, ResearchGap.project_id == project_id
    ))).scalar_one_or_none()
    if gap is None:
        raise HTTPException(404, "Research gap not found")
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "Provide a note or status to update")
    for key, value in changes.items():
        setattr(gap, key, value)
    await db.commit()
    await db.refresh(gap)
    return gap_out(gap)


@router.delete("/gaps/{gap_id}", status_code=204)
async def delete_gap(project_id: uuid.UUID, gap_id: uuid.UUID,
                     db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> None:
    await require_editor(project_id, user, db)
    gap = (await db.execute(select(ResearchGap).where(
        ResearchGap.id == gap_id, ResearchGap.project_id == project_id
    ))).scalar_one_or_none()
    if gap is None:
        raise HTTPException(404, "Research gap not found")
    await db.delete(gap)
    await db.commit()
