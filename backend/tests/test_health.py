"""Foundation health route contract."""
from fastapi.testclient import TestClient
from app.main import app


def test_api_root_contract() -> None:
    with TestClient(app) as client:
        response = client.get("/api/v1/")
    assert response.status_code == 200
    assert response.json()["name"] == "ResearchForge"
