"""Deterministic PDF text extraction helpers used by the library module."""
from dataclasses import dataclass
import fitz

MAX_EXTRACT_PAGES = 500
MAX_EXTRACTED_CHARS = 5_000_000

@dataclass(frozen=True)
class ExtractionResult:
    text: str
    page_count: int

def extract_pdf_text(content: bytes) -> ExtractionResult:
    """Extract selectable text from PDF bytes; OCR is intentionally not implied."""
    if not content.startswith(b"%PDF-"):
        raise ValueError("Uploaded file is not a valid PDF")
    try:
        with fitz.open(stream=content, filetype="pdf") as document:
            if document.is_encrypted:
                raise ValueError("Password-protected PDFs are not supported")
            if document.page_count == 0:
                raise ValueError("PDF contains no pages")
            if document.page_count > MAX_EXTRACT_PAGES:
                raise ValueError(f"PDF exceeds the {MAX_EXTRACT_PAGES}-page extraction limit")
            chunks = []
            total = 0
            for page in document:
                chunk = page.get_text("text") or ""
                remaining = MAX_EXTRACTED_CHARS - total
                if len(chunk) > remaining:
                    chunk = chunk[:remaining]
                chunks.append(chunk)
                total += len(chunk)
                if total >= MAX_EXTRACTED_CHARS:
                    break
            text = "\n\n".join(part.strip() for part in chunks if part.strip()).strip()
            if not text:
                raise ValueError("No selectable text was found; scanned PDFs require OCR")
            return ExtractionResult(text=text, page_count=document.page_count)
    except fitz.FileDataError as exc:
        raise ValueError("Could not read PDF content") from exc
