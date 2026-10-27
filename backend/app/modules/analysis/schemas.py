"""Request validation for comparisons and research-gap notes."""
from uuid import UUID
from pydantic import BaseModel, Field, field_validator


class ComparisonCreate(BaseModel):
    title: str = Field(default="Paper comparison", min_length=1, max_length=200)
    paper_ids: list[UUID] = Field(min_length=2, max_length=30)

    @field_validator("title")
    @classmethod
    def title_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Title cannot be blank")
        return value

    @field_validator("paper_ids")
    @classmethod
    def unique_papers(cls, value: list[UUID]) -> list[UUID]:
        if len(set(value)) != len(value):
            raise ValueError("A paper can only be selected once")
        return value


class GapCreate(BaseModel):
    note: str = Field(min_length=1, max_length=10000)
    comparison_id: UUID | None = None

    @field_validator("note")
    @classmethod
    def note_not_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Gap note cannot be blank")
        return value


class GapUpdate(BaseModel):
    note: str | None = Field(default=None, min_length=1, max_length=10000)
    status: str | None = None

    @field_validator("note")
    @classmethod
    def update_note_not_blank(cls, value: str | None) -> str | None:
        if value is not None and not value.strip():
            raise ValueError("Gap note cannot be blank")
        return value.strip() if value is not None else None

    @field_validator("status")
    @classmethod
    def valid_status(cls, value: str | None) -> str | None:
        if value is not None and value not in {"OPEN", "ADDRESSED"}:
            raise ValueError("Status must be OPEN or ADDRESSED")
        return value
