"""Premium-gated AI research endpoints."""
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.deps import get_current_user, get_project_for_member
from app.modules.users.models import User
from app.modules.library.models import LibraryPaper
from app.modules.billing.service import get_subscription, is_premium
from app.modules.ai.providers import generate_research_summary

router = APIRouter(prefix="/projects/{project_id}/ai", tags=["premium-ai"])


class SummaryOut(BaseModel):
    paper_id: UUID
    title: str
    provider: str
    model: str
    summary: str
    source_text_characters: int
    source_text_truncated: bool
    disclaimer: str = Field(default="AI output may be incomplete. Verify claims against the original paper.")


@router.post("/papers/{paper_id}/summary", response_model=SummaryOut)
async def summarize_paper(project_id: UUID, paper_id: UUID,
                          db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> SummaryOut:
    await get_project_for_member(project_id, user, db)
    subscription = await get_subscription(db, user)
    await db.commit()
    if not is_premium(subscription):
        raise HTTPException(status_code=402, detail={"code": "PREMIUM_REQUIRED",
            "message": "Paper summaries require an active Premium subscription.",
            "upgrade_path": "/api/v1/billing/subscription"})
    result = await db.execute(select(LibraryPaper).where(
        LibraryPaper.id == paper_id, LibraryPaper.project_id == project_id))
    paper = result.scalar_one_or_none()
    if paper is None:
        raise HTTPException(status_code=404, detail="Paper not found in this project")
    text = (paper.extracted_text or "").strip()
    if not text:
        raise HTTPException(status_code=409, detail="Extract PDF text before requesting a summary")
    truncated = len(text) > 24000
    generated = await generate_research_summary(paper.title, text)
    return SummaryOut(paper_id=paper.id, title=paper.title, provider=generated.provider,
                      model=generated.model, summary=generated.text,
                      source_text_characters=min(len(text), 24000), source_text_truncated=truncated)
