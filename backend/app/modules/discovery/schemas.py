from pydantic import BaseModel, Field
from typing import Literal

class PaperResult(BaseModel):
    source: str
    source_id: str
    title: str
    authors: list[str] = []
    year: int | None = None
    venue: str | None = None
    citation_count: int | None = None
    abstract: str = ""
    doi: str | None = None
    pdf_url: str | None = None
    landing_url: str | None = None

class SearchResponse(BaseModel):
    query: str
    results: list[PaperResult]
    warnings: list[str] = []

class SearchRequest(BaseModel):
    query: str = Field(min_length=2, max_length=300)
    sources: list[Literal["arxiv", "semantic_scholar"]] = ["arxiv", "semantic_scholar"]
    limit: int = Field(default=10, ge=1, le=50)
