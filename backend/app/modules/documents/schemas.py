"""Validation schemas for project document generation."""
from pydantic import BaseModel, Field, field_validator

DEFAULT_SECTIONS = [
    "overview", "literature", "summaries", "comparisons", "gaps", "ai_insights", "references"
]


class DocumentCreate(BaseModel):
    title: str = Field(default="ResearchForge Project Report", min_length=1, max_length=200)
    sections: list[str] = Field(default_factory=lambda: DEFAULT_SECTIONS.copy(), min_length=1, max_length=7)
    include_ai: bool = False

    @field_validator("sections")
    @classmethod
    def validate_sections(cls, sections: list[str]) -> list[str]:
        allowed = set(DEFAULT_SECTIONS)
        if len(sections) != len(set(sections)):
            raise ValueError("Sections must not contain duplicates")
        if any(section not in allowed for section in sections):
            raise ValueError("Unknown document section")
        return sections
