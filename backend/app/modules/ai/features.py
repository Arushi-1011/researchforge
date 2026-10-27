"""Premium-only, explicit-request research features with persisted, evidence-linked outputs."""
import json
import re
import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.deps import get_current_user, get_project_for_member
from app.core.ratelimit import ai_limiter
from app.modules.users.models import User
from app.modules.library.models import LibraryPaper
from app.modules.analysis.models import ResearchGap
from app.modules.billing.service import get_subscription, is_premium
from app.modules.ai.models import AIResultRecord
from app.modules.ai.providers import generate_feature_result

router = APIRouter(prefix="/projects/{project_id}/ai", tags=["premium-ai-features"])
DISCLAIMER = "AI-assisted output may be incomplete. Verify every claim against the cited source text."


class PaperSelection(BaseModel):
    paper_ids: list[uuid.UUID] = Field(min_length=1, max_length=20)


class RecommendationsIn(BaseModel):
    # An empty list intentionally means all papers in the selected project.
    paper_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


class QuestionIn(BaseModel):
    question: str = Field(min_length=3, max_length=2000)
    paper_ids: list[uuid.UUID] = Field(default_factory=list, max_length=20)


class SaveGapsIn(BaseModel):
    result_id: uuid.UUID
    gap_indexes: list[int] = Field(min_length=1, max_length=20)


async def premium_user(project_id: uuid.UUID, db: AsyncSession, user: User) -> None:
    await get_project_for_member(project_id, user, db)
    subscription = await get_subscription(db, user)
    if not is_premium(subscription):
        raise HTTPException(status_code=402, detail={"code": "PREMIUM_REQUIRED",
            "message": "This AI feature requires an active Premium subscription.",
            "upgrade_path": "/api/v1/billing/subscription"})


async def load_papers(project_id: uuid.UUID, ids: list[uuid.UUID] | None, db: AsyncSession) -> list[LibraryPaper]:
    query = select(LibraryPaper).where(LibraryPaper.project_id == project_id)
    if ids:
        query = query.where(LibraryPaper.id.in_(ids))
    rows = list((await db.execute(query.order_by(LibraryPaper.created_at))).scalars().all())
    if ids and len(rows) != len(set(ids)):
        raise HTTPException(422, "Every selected paper must belong to this project's library")
    return rows


def evidence_for(papers: list[LibraryPaper], max_chars: int = 30000) -> list[dict[str, Any]]:
    out = []
    remaining = max_chars
    for paper in papers:
        text = (paper.extracted_text or paper.abstract or "").strip()
        if not text or remaining <= 0:
            continue
        excerpt = text[:min(6000, remaining)]
        out.append({"paper_id": str(paper.id), "title": paper.title, "excerpt": excerpt})
        remaining -= len(excerpt)
    return out


async def persist(db: AsyncSession, project_id: uuid.UUID, user: User, feature: str,
                  generated: Any, result: dict[str, Any], evidence: list[dict[str, Any]],
                  paper_id: uuid.UUID | None = None) -> dict[str, Any]:
    record = AIResultRecord(project_id=project_id, user_id=user.id, paper_id=paper_id,
        feature=feature, provider=generated.provider, model=generated.model,
        result_json=json.dumps(result, ensure_ascii=False), reasoning=result.get("reasoning", ""),
        evidence_json=json.dumps(evidence, ensure_ascii=False))
    db.add(record)
    await db.commit()
    await db.refresh(record)
    return {"id": str(record.id), "feature": feature, "provider": generated.provider,
        "model": generated.model, "result": result, "reasoning": result.get("reasoning", ""),
        "evidence": evidence, "disclaimer": DISCLAIMER, "created_at": record.created_at.isoformat()}


async def run_feature(project_id: uuid.UUID, user: User, db: AsyncSession, feature: str,
                      papers: list[LibraryPaper], instruction: str,
                      paper_id: uuid.UUID | None = None) -> dict[str, Any]:
    await ai_limiter.check(str(user.id))
    evidence = evidence_for(papers)
    if not evidence:
        raise HTTPException(409, "Extract PDF text or add an abstract before requesting this feature")
    generated = await generate_feature_result(feature, instruction, evidence)
    result: dict[str, Any] = {
        "text": generated.text,
        "reasoning": "Generated from the supplied project papers; inspect the evidence excerpts before relying on the result.",
    }
    # Gap saving is a structured endpoint. Preserve a provider's JSON gap list when
    # it actually returns one, while retaining the original text for display and
    # leaving unstructured/fake-provider output untouched.
    if feature == "gaps":
        try:
            parsed = json.loads(generated.text)
        except (TypeError, ValueError):
            parsed = None
        if isinstance(parsed, dict) and isinstance(parsed.get("gaps"), list):
            candidates = [item for item in parsed["gaps"] if isinstance(item, dict)]
            if candidates:
                result["gaps"] = candidates
    return await persist(db, project_id, user, feature, generated, result, evidence, paper_id)


@router.post("/gaps")
async def identify_gaps(project_id: uuid.UUID, data: PaperSelection,
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await premium_user(project_id, db, user)
    papers = await load_papers(project_id, data.paper_ids, db)
    return await run_feature(project_id, user, db, "gaps", papers,
        "Identify possible research gaps across only the provided papers. Return only a JSON object with a top-level \"gaps\" array. Each gap must contain \"title\", \"description\", \"supporting_paper_ids\" (IDs from the supplied evidence only), and \"suggested_direction\". Separate evidence from hypotheses. Do not invent claims or citations. If there is insufficient evidence, return {\"gaps\": []}. Do not include any additional prose.")


@router.post("/gaps/save")
async def save_generated_gaps(project_id: uuid.UUID, data: SaveGapsIn,
                              db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await premium_user(project_id, db, user)
    record = (await db.execute(select(AIResultRecord).where(
        AIResultRecord.id == data.result_id, AIResultRecord.project_id == project_id,
        AIResultRecord.feature == "gaps"))).scalar_one_or_none()
    if record is None:
        raise HTTPException(404, "Gap-analysis result not found")
    payload = json.loads(record.result_json)
    candidates = payload.get("gaps", [])
    if not candidates:
        raise HTTPException(422, "This provider result has no structured gaps to save; review it and add notes manually")
    saved = []
    for idx in data.gap_indexes:
        if idx < 0 or idx >= len(candidates):
            raise HTTPException(422, f"Gap index {idx} is outside the result")
        gap = candidates[idx]
        note = str(gap.get("description") or gap.get("title") or "").strip()
        if not note:
            continue
        row = ResearchGap(project_id=project_id, note=note, status="OPEN", origin="AI", created_by=user.id)
        db.add(row); saved.append(row)
    await db.commit()
    return {"saved_count": len(saved), "gap_ids": [str(g.id) for g in saved]}


@router.post("/compare")
async def ai_compare(project_id: uuid.UUID, data: PaperSelection,
                     db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await premium_user(project_id, db, user)
    if len(set(data.paper_ids)) < 2:
        raise HTTPException(422, "AI comparison requires at least two distinct papers")
    papers = await load_papers(project_id, data.paper_ids, db)
    if len(papers) < 2:
        raise HTTPException(422, "AI comparison requires at least two papers in this project")
    return await run_feature(project_id, user, db, "comparison", papers,
        "Compare the provided papers by problem, method, data, findings, and limitations. State unknown values as not stated. Distinguish direct evidence from interpretation.")


@router.post("/recommendations")
async def recommendations(project_id: uuid.UUID, data: RecommendationsIn,
                           db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await premium_user(project_id, db, user)
    papers = await load_papers(project_id, data.paper_ids or None, db)
    return await run_feature(project_id, user, db, "recommendations", papers,
        "Suggest up to five concrete next research directions grounded in the supplied papers. Include a rationale and which provided paper supports it. Do not fabricate publications or citations.")


@router.post("/citations")
async def citation_analysis(project_id: uuid.UUID, data: PaperSelection,
                            db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await premium_user(project_id, db, user)
    papers = await load_papers(project_id, data.paper_ids, db)
    # Only locally stored metadata is used; no citation metrics are fabricated.
    metrics = [{"paper_id": str(p.id), "title": p.title, "doi": p.doi,
                "source": p.source, "year": p.year, "citation_data": "not available in stored project metadata"}
               for p in papers]
    generated = await generate_feature_result("citations",
        "Explain what can and cannot be concluded from this locally stored citation metadata. Do not infer citation counts.", metrics)
    return await persist(db, project_id, user, "citations", generated,
        {"papers": metrics, "narrative": generated.text, "reasoning": "Citation counts were not present in stored metadata; none were invented."},
        metrics)


@router.post("/qa")
async def ask_papers(project_id: uuid.UUID, data: QuestionIn,
                     db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await premium_user(project_id, db, user)
    papers = await load_papers(project_id, data.paper_ids or None, db)
    # Bounded lexical retrieval: select sentences that overlap question terms; no vector embeddings are created.
    terms = {t.lower() for t in re.findall(r"[A-Za-z0-9]{3,}", data.question) if t.lower() not in {"what","which","does","with","from","that","this","paper","about"}}
    chunks = []
    for paper in papers:
        source = (paper.extracted_text or paper.abstract or "")
        sentences = re.split(r"(?<=[.!?])\s+", source)
        ranked = sorted(((sum(term in sentence.lower() for term in terms), sentence.strip()) for sentence in sentences),
                        key=lambda item: item[0], reverse=True)
        for score, sentence in ranked[:4]:
            if score and sentence:
                chunks.append({"paper_id": str(paper.id), "title": paper.title, "excerpt": sentence[:1200], "term_overlap": score})
    chunks.sort(key=lambda c: c["term_overlap"], reverse=True)
    chunks = chunks[:8]
    if not chunks:
        return {"answer": "The available publications don't answer this.", "evidence": [], "disclaimer": DISCLAIMER}
    generated = await generate_feature_result("qa", f"Answer this question only from the evidence excerpts. If evidence is insufficient, say exactly: The available publications don't answer this. Question: {data.question}", chunks)
    return await persist(db, project_id, user, "qa", generated,
        {"question": data.question, "answer": generated.text, "reasoning": "Answer is restricted to retrieved excerpts; verify the cited passages."},
        chunks)
