"""Project-scoped template-based document generation and export."""
import json
import re
import uuid
from datetime import datetime, timezone
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.db import get_db
from app.core.deps import get_current_user, get_project_for_member
from app.modules.users.models import User
from app.modules.projects.models import Project
from app.modules.library.models import LibraryPaper
from app.modules.analysis.models import Comparison, ComparisonPaper, ResearchGap
from app.modules.ai.models import AIResultRecord
from app.modules.documents.models import ProjectDocument
from app.modules.documents.schemas import DocumentCreate
from app.modules.documents.renderers import render_html, render_pdf, render_docx

router = APIRouter(prefix="/projects/{project_id}/documents", tags=["documents"])
SECTION_TITLES = {
    "overview": "1. Project Overview", "literature": "2. Literature Table",
    "summaries": "3. Publication Summaries", "comparisons": "4. Methodology Comparison",
    "gaps": "5. Research Gaps", "ai_insights": "6. AI Insights", "references": "7. References"
}


def slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip()).strip("-").lower()
    return (slug[:80] or "researchforge-document")


async def build_content(project_id: uuid.UUID, title: str, sections: list[str],
                        include_ai: bool, db: AsyncSession) -> dict:
    project = (await db.execute(select(Project).where(Project.id == project_id))).scalar_one()
    papers = list((await db.execute(select(LibraryPaper).where(
        LibraryPaper.project_id == project_id).order_by(LibraryPaper.created_at))).scalars().all())
    comparisons = list((await db.execute(select(Comparison).where(
        Comparison.project_id == project_id).order_by(Comparison.created_at))).scalars().all())
    gaps = list((await db.execute(select(ResearchGap).where(
        ResearchGap.project_id == project_id).order_by(ResearchGap.status, ResearchGap.created_at))).scalars().all())
    ai_rows = []
    if include_ai:
        ai_rows = list((await db.execute(select(AIResultRecord).where(
            AIResultRecord.project_id == project_id).order_by(AIResultRecord.created_at))).scalars().all())
    result_sections = []
    for key in sections:
        section = {"key": key, "title": SECTION_TITLES[key], "kind": "list", "items": [], "text": ""}
        if key == "overview":
            section["text"] = project.description.strip() or "No project description has been added yet."
            section["items"] = [f"Project name: {project.name}", f"Papers in library: {len(papers)}",
                                f"Saved comparisons: {len(comparisons)}", f"Research-gap notes: {len(gaps)}"]
        elif key == "literature":
            section.update(kind="table", headers=["#", "Title", "Authors", "Year", "Source", "DOI"])
            section["rows"] = [[str(i), p.title, p.authors.replace("\n", ", "), str(p.year or "Not stated"),
                                p.source, p.doi or "Not stated"] for i, p in enumerate(papers, 1)]
        elif key == "summaries":
            section["items"] = [
                f"{p.title}: {(p.extracted_text or p.abstract or '').strip()[:700] or 'No extracted text or abstract available.'}"
                for p in papers]
        elif key == "comparisons":
            section["items"] = []
            for comparison in comparisons:
                ids = (await db.execute(select(ComparisonPaper.paper_id).where(
                    ComparisonPaper.comparison_id == comparison.id).order_by(ComparisonPaper.position))).scalars().all()
                titles = [p.title for p in papers if p.id in ids]
                section["items"].append(f"{comparison.title}: " + ("; ".join(titles) if titles else "No linked papers"))
        elif key == "gaps":
            section["items"] = [f"[{gap.status}] {gap.note}" for gap in gaps]
        elif key == "ai_insights":
            section["items"] = []
            if include_ai:
                for item in ai_rows:
                    try:
                        parsed = json.loads(item.result_json)
                        readable = json.dumps(parsed, ensure_ascii=False)
                    except (ValueError, TypeError):
                        readable = item.result_json
                    section["items"].append(f"{item.feature.title()} ({item.provider}/{item.model}): {readable[:1600]}")
        elif key == "references":
            section["items"] = []
            for i, paper in enumerate(papers, 1):
                authors = paper.authors.replace("\n", ", ").strip() or "Author not stated"
                year = str(paper.year) if paper.year else "n.d."
                doi = f" DOI: {paper.doi}." if paper.doi else ""
                url = f" Available at: {paper.landing_url}." if paper.landing_url else ""
                section["items"].append(f"[{i}] {authors}, \"{paper.title},\" {year}.{doi}{url}")
        result_sections.append(section)
    return {"title": title, "created_at": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
            "project_name": project.name, "sections": result_sections}


def serialize(doc: ProjectDocument) -> dict:
    return {"id": str(doc.id), "project_id": str(doc.project_id), "title": doc.title,
            "sections": json.loads(doc.sections_json), "include_ai": doc.include_ai,
            "created_at": doc.created_at.isoformat()}


@router.post("", status_code=201)
async def create_document(project_id: uuid.UUID, data: DocumentCreate,
                          db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await get_project_for_member(project_id, user, db)
    content = await build_content(project_id, data.title, data.sections, data.include_ai, db)
    document = ProjectDocument(project_id=project_id, created_by=user.id, title=data.title,
        sections_json=json.dumps(data.sections), content_json=json.dumps(content, ensure_ascii=False),
        include_ai=data.include_ai)
    db.add(document)
    await db.commit()
    await db.refresh(document)
    return {**serialize(document), "content": content}


@router.get("")
async def list_documents(project_id: uuid.UUID, limit: int = 50, offset: int = 0,
                         db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> list[dict]:
    await get_project_for_member(project_id, user, db)
    if limit < 1 or limit > 100 or offset < 0:
        raise HTTPException(422, "limit must be 1–100 and offset must be non-negative")
    rows = (await db.execute(select(ProjectDocument).where(
        ProjectDocument.project_id == project_id).order_by(ProjectDocument.created_at.desc())
        .limit(limit).offset(offset))).scalars().all()
    return [serialize(row) for row in rows]


async def get_document(project_id: uuid.UUID, document_id: uuid.UUID,
                       db: AsyncSession) -> ProjectDocument:
    row = (await db.execute(select(ProjectDocument).where(
        ProjectDocument.id == document_id, ProjectDocument.project_id == project_id))).scalar_one_or_none()
    if row is None:
        raise HTTPException(404, "Document not found")
    return row


@router.get("/{document_id}")
async def document_detail(project_id: uuid.UUID, document_id: uuid.UUID,
                          db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> dict:
    await get_project_for_member(project_id, user, db)
    doc = await get_document(project_id, document_id, db)
    return {**serialize(doc), "content": json.loads(doc.content_json)}


@router.get("/{document_id}/view", response_class=HTMLResponse)
async def document_view(project_id: uuid.UUID, document_id: uuid.UUID,
                        db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> HTMLResponse:
    await get_project_for_member(project_id, user, db)
    doc = await get_document(project_id, document_id, db)
    return HTMLResponse(render_html(json.loads(doc.content_json)))


@router.get("/{document_id}/export.pdf")
async def export_pdf(project_id: uuid.UUID, document_id: uuid.UUID,
                     db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> StreamingResponse:
    await get_project_for_member(project_id, user, db)
    doc = await get_document(project_id, document_id, db)
    try:
        payload = render_pdf(json.loads(doc.content_json))
    except Exception as exc:
        raise HTTPException(503, "PDF renderer unavailable; check WeasyPrint system dependencies") from exc
    return StreamingResponse(BytesIO(payload), media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{slugify(doc.title)}.pdf"'})


@router.get("/{document_id}/export.docx")
async def export_docx(project_id: uuid.UUID, document_id: uuid.UUID,
                      db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> StreamingResponse:
    await get_project_for_member(project_id, user, db)
    doc = await get_document(project_id, document_id, db)
    payload = render_docx(json.loads(doc.content_json))
    return StreamingResponse(BytesIO(payload),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{slugify(doc.title)}.docx"'})
