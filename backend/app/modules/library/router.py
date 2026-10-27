"""Project-scoped paper import and PDF upload endpoints."""
import uuid
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_user, get_project_for_member
from app.modules.users.models import User
from app.modules.library.models import LibraryPaper
from app.modules.library.schemas import ImportPaperIn
from app.modules.library.extraction import extract_pdf_text

router = APIRouter(prefix="/projects/{project_id}/library", tags=["library"])
UPLOAD_ROOT = Path(settings.storage_dir).resolve() / "uploads"
MAX_PDF_BYTES = 25 * 1024 * 1024

def serialize(p: LibraryPaper) -> dict:
    return {"id":str(p.id),"project_id":str(p.project_id),"source":p.source,"source_id":p.source_id,"title":p.title,"authors":[a for a in p.authors.split("\n") if a],"year":p.year,"abstract":p.abstract,"doi":p.doi,"landing_url":p.landing_url,"pdf_path":p.pdf_path,"extraction_status":p.extraction_status,"page_count":p.page_count,"extracted_at":p.extracted_at.isoformat() if p.extracted_at else None}

@router.get("")
async def list_library(project_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await get_project_for_member(project_id,user,db)
    rows = await db.execute(select(LibraryPaper).where(LibraryPaper.project_id==project_id).order_by(LibraryPaper.created_at.desc()))
    return [serialize(p) for p in rows.scalars()]

@router.post("/import", status_code=201)
async def import_paper(project_id: uuid.UUID, data: ImportPaperIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await get_project_for_member(project_id,user,db)
    if data.source_id:
        existing = (await db.execute(select(LibraryPaper).where(LibraryPaper.project_id==project_id,LibraryPaper.source==data.source,LibraryPaper.source_id==data.source_id))).scalar_one_or_none()
        if existing: raise HTTPException(409,"Paper is already in this project's library")
    paper=LibraryPaper(project_id=project_id,imported_by=user.id,source=data.source,source_id=data.source_id,title=data.title.strip(),authors="\n".join(data.authors),year=data.year,abstract=data.abstract,doi=data.doi,landing_url=str(data.landing_url) if data.landing_url else None)
    db.add(paper); await db.commit(); await db.refresh(paper)
    return serialize(paper)

@router.post("/upload", status_code=201)
async def upload_pdf(project_id: uuid.UUID, file: UploadFile = File(...), db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    await get_project_for_member(project_id,user,db)
    if not file.filename or not file.filename.lower().endswith(".pdf") or file.content_type not in ("application/pdf", "application/octet-stream"):
        raise HTTPException(415,"Only PDF files are accepted")
    content=await file.read(MAX_PDF_BYTES+1)
    if len(content)>MAX_PDF_BYTES: raise HTTPException(413,"PDF exceeds 25 MB limit")
    if not content.startswith(b"%PDF-"): raise HTTPException(415,"Uploaded file is not a valid PDF")
    safe_name=f"{uuid.uuid4()}.pdf"; folder=UPLOAD_ROOT/str(project_id); folder.mkdir(parents=True,exist_ok=True); target=folder/safe_name
    target.write_bytes(content)
    paper=LibraryPaper(project_id=project_id,imported_by=user.id,source="upload",source_id=safe_name,title=Path(file.filename).stem[:1000],pdf_path=str(target.relative_to(UPLOAD_ROOT)))
    db.add(paper); await db.commit(); await db.refresh(paper)
    return serialize(paper)


@router.post("/{paper_id}/extract")
async def extract_paper(project_id: uuid.UUID, paper_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Extract and persist selectable text from a PDF uploaded to this project."""
    await get_project_for_member(project_id, user, db)
    result = await db.execute(select(LibraryPaper).where(LibraryPaper.id == paper_id, LibraryPaper.project_id == project_id))
    paper = result.scalar_one_or_none()
    if paper is None:
        raise HTTPException(404, "Paper not found in this project's library")
    if not paper.pdf_path:
        raise HTTPException(422, "This paper has no uploaded PDF attached")
    root = UPLOAD_ROOT.resolve()
    path = (root / paper.pdf_path).resolve()
    if root not in path.parents or not path.is_file():
        raise HTTPException(404, "Stored PDF file was not found")
    try:
        extracted = extract_pdf_text(path.read_bytes())
    except ValueError as exc:
        paper.extraction_status = "failed"
        await db.commit()
        raise HTTPException(422, str(exc)) from exc
    paper.extracted_text = extracted.text
    paper.page_count = extracted.page_count
    paper.extraction_status = "completed"
    paper.extracted_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(paper)
    return {"paper_id": str(paper.id), "title": paper.title, "extraction_status": paper.extraction_status, "page_count": paper.page_count, "character_count": len(paper.extracted_text or ""), "text": paper.extracted_text}

@router.get("/{paper_id}/extraction")
async def get_extraction(project_id: uuid.UUID, paper_id: uuid.UUID, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    """Read previously extracted text; only project members can access it."""
    await get_project_for_member(project_id, user, db)
    result = await db.execute(select(LibraryPaper).where(LibraryPaper.id == paper_id, LibraryPaper.project_id == project_id))
    paper = result.scalar_one_or_none()
    if paper is None:
        raise HTTPException(404, "Paper not found in this project's library")
    if paper.extraction_status != "completed" or paper.extracted_text is None:
        raise HTTPException(404, "No extracted text is available; run the extract endpoint first")
    return {"paper_id": str(paper.id), "title": paper.title, "extraction_status": paper.extraction_status, "page_count": paper.page_count, "character_count": len(paper.extracted_text), "text": paper.extracted_text, "extracted_at": paper.extracted_at.isoformat() if paper.extracted_at else None}
