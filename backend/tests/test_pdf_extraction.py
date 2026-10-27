import fitz
import pytest
from app.modules.library.extraction import extract_pdf_text

def make_pdf(text: str) -> bytes:
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text)
    data = doc.tobytes()
    doc.close()
    return data

def test_extract_pdf_text_returns_text_and_page_count() -> None:
    result = extract_pdf_text(make_pdf("ResearchForge extraction test"))
    assert "ResearchForge extraction test" in result.text
    assert result.page_count == 1

def test_rejects_non_pdf_bytes() -> None:
    with pytest.raises(ValueError, match="valid PDF"):
        extract_pdf_text(b"not a pdf")

def test_rejects_scanned_or_empty_text_pdf() -> None:
    doc = fitz.open()
    doc.new_page()
    data = doc.tobytes()
    doc.close()
    with pytest.raises(ValueError, match="selectable text"):
        extract_pdf_text(data)
