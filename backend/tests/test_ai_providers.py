import pytest
from app.modules.ai.providers import generate_research_summary


@pytest.mark.asyncio
async def test_fake_provider_is_explicitly_labelled(monkeypatch):
    from app.core.config import settings
    monkeypatch.setattr(settings, "llm_provider", "fake")
    result = await generate_research_summary("Test title", "A research paper excerpt.")
    assert result.provider == "fake"
    assert "not AI-generated" in result.text
    assert "A research paper excerpt." in result.text
