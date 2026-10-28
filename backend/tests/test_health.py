"""Foundation health route contract."""
from unittest.mock import AsyncMock

from fastapi.testclient import TestClient

from app.core.db import get_db
from app.main import app


def test_api_root_contract() -> None:
    # Override the DB dependency so no real Postgres connection is needed in CI.
    app.dependency_overrides[get_db] = lambda: AsyncMock()
    try:
        with TestClient(app) as client:
            response = client.get("/api/v1/")
        assert response.status_code == 200
        assert response.json()["name"] == "ResearchForge"
    finally:
        app.dependency_overrides.clear()
