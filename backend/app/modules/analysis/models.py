"""Saved paper comparisons and user-authored research-gap notes."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class Comparison(Base):
    __tablename__ = "comparisons"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(200))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)


class ComparisonPaper(Base):
    __tablename__ = "comparison_papers"
    __table_args__ = (UniqueConstraint("comparison_id", "paper_id", name="uq_comparison_paper"),)
    comparison_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("comparisons.id", ondelete="CASCADE"), primary_key=True)
    paper_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("library_papers.id", ondelete="CASCADE"), primary_key=True)
    position: Mapped[int] = mapped_column(default=0)


class ResearchGap(Base):
    __tablename__ = "research_gaps"
    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    project_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("projects.id", ondelete="CASCADE"), index=True)
    comparison_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("comparisons.id", ondelete="CASCADE"), nullable=True, index=True)
    note: Mapped[str] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), default="OPEN")
    origin: Mapped[str] = mapped_column(String(20), default="USER")
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=utcnow)
