"""Fast tests for deterministic AI-feature preparation helpers."""
import uuid
from types import SimpleNamespace
from app.modules.ai.features import evidence_for


def test_evidence_uses_extracted_text_and_keeps_paper_identity():
    paper = SimpleNamespace(id=uuid.uuid4(), title="Paper A", extracted_text="A" * 50, abstract="fallback")
    result = evidence_for([paper], max_chars=20)
    assert len(result) == 1
    assert result[0]["paper_id"] == str(paper.id)
    assert result[0]["title"] == "Paper A"
    assert result[0]["excerpt"] == "A" * 20


def test_evidence_falls_back_to_abstract_when_text_missing():
    paper = SimpleNamespace(id=uuid.uuid4(), title="Paper B", extracted_text=None, abstract="An abstract.")
    result = evidence_for([paper])
    assert result[0]["excerpt"] == "An abstract."


def test_evidence_skips_empty_papers():
    paper = SimpleNamespace(id=uuid.uuid4(), title="Paper C", extracted_text=" ", abstract="")
    assert evidence_for([paper]) == []
