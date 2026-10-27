from pydantic import BaseModel, Field, HttpUrl
class ImportPaperIn(BaseModel):
    source: str = Field(default="manual", max_length=40)
    source_id: str = Field(default="", max_length=300)
    title: str = Field(min_length=1, max_length=1000)
    authors: list[str] = []
    year: int | None = None
    abstract: str = ""
    doi: str | None = None
    landing_url: HttpUrl | None = None
class PaperOut(BaseModel):
    id: str
    project_id: str
    source: str
    source_id: str
    title: str
    authors: list[str]
    year: int | None
    abstract: str
    doi: str | None
    landing_url: str | None
    pdf_path: str | None
