"""Persisted research-paper records attached to projects."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class LibraryPaper(Base):
    __tablename__ = "library_papers"
    __table_args__ = (
        UniqueConstraint("project_id", "source", "source_id", name="uq_library_paper_source"),
    )

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"), index=True
    )
    imported_by: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source: Mapped[str] = mapped_column(String(40), default="manual")
    source_id: Mapped[str] = mapped_column(String(300), default="")
    title: Mapped[str] = mapped_column(String(1000))
    authors: Mapped[str] = mapped_column(Text, default="")
    year: Mapped[int | None] = mapped_column(nullable=True)
    abstract: Mapped[str] = mapped_column(Text, default="")
    doi: Mapped[str | None] = mapped_column(String(300), nullable=True)
    landing_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    pdf_path: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    extracted_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    extraction_status: Mapped[str] = mapped_column(String(20), default="pending")
    page_count: Mapped[int | None] = mapped_column(nullable=True)
    extracted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
