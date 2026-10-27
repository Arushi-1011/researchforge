"""Regression tests for Phase 9 security defaults and middleware."""
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.middleware import SecurityHeadersMiddleware


def test_production_rejects_default_jwt_secret() -> None:
    settings = Settings(app_env="production", jwt_secret="dev-only-change-me")
    with pytest.raises(ValueError, match="JWT_SECRET"):
        settings.validate_production()


def test_production_accepts_explicit_secret_and_origin() -> None:
    settings = Settings(
        app_env="production",
        jwt_secret="a-unique-production-secret-that-is-long-enough",
        frontend_origin="https://researchforge.example",
    )
    settings.validate_production()


def test_security_headers_and_request_id() -> None:
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware)

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"status": "ok"}

    with TestClient(app) as client:
        response = client.get("/ping")
        assert response.status_code == 200
        assert response.headers["x-content-type-options"] == "nosniff"
        assert response.headers["x-frame-options"] == "DENY"
        assert response.headers["referrer-policy"] == "strict-origin-when-cross-origin"
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-request-id"]


def test_valid_request_id_is_propagated() -> None:
    app = FastAPI()
    app.add_middleware(SecurityHeadersMiddleware)

    @app.get("/ping")
    async def ping() -> dict[str, str]:
        return {"status": "ok"}

    with TestClient(app) as client:
        response = client.get("/ping", headers={"X-Request-ID": "test-run-123"})
    assert response.headers["x-request-id"] == "test-run-123"
