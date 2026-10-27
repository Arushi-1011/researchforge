"""Validation tests for comparison and research-gap requests."""
from uuid import uuid4
import pytest
from pydantic import ValidationError
from app.modules.analysis.schemas import ComparisonCreate, GapCreate, GapUpdate


def test_comparison_requires_at_least_two_papers() -> None:
    with pytest.raises(ValidationError):
        ComparisonCreate(paper_ids=[uuid4()])


def test_comparison_rejects_duplicate_paper_ids() -> None:
    paper_id = uuid4()
    with pytest.raises(ValidationError, match="only be selected once"):
        ComparisonCreate(paper_ids=[paper_id, paper_id])


def test_comparison_trims_title() -> None:
    request = ComparisonCreate(title="  Method comparison  ", paper_ids=[uuid4(), uuid4()])
    assert request.title == "Method comparison"


def test_gap_rejects_blank_note() -> None:
    with pytest.raises(ValidationError, match="cannot be blank"):
        GapCreate(note="   ")


def test_gap_update_only_accepts_known_statuses() -> None:
    with pytest.raises(ValidationError, match="OPEN or ADDRESSED"):
        GapUpdate(status="DONE")


def test_gap_update_can_mark_addressed() -> None:
    assert GapUpdate(status="ADDRESSED").status == "ADDRESSED"
