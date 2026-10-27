"""ResearchForge API entrypoint."""
from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from starlette.responses import JSONResponse

from app.core.config import settings
from app.core.db import engine
from app.core.errors import validation_error_handler
from app.core.logging import configure_logging
from app.core.middleware import SecurityHeadersMiddleware
from app.modules.users.router import router as auth_router
from app.modules.projects.router import router as projects_router
from app.modules.discovery.router import router as discovery_router
from app.modules.analysis.router import router as analysis_router
from app.modules.library.router import router as library_router
from app.modules.billing.router import router as billing_router
from app.modules.ai.router import router as ai_router
from app.modules.ai.features import router as ai_features_router
from app.modules.documents.router import router as documents_router
from app.modules.quant.router import router as quant_router

configure_logging()
settings.validate_production()
_docs_enabled = settings.docs_enabled and settings.app_env.lower() != "production"
app = FastAPI(
    title="ResearchForge API",
    version="0.3.0",
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)
app.add_middleware(SecurityHeadersMiddleware, request_id_header=settings.request_id_header)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_origin],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type", settings.request_id_header],
    expose_headers=[settings.request_id_header],
)
app.add_exception_handler(RequestValidationError, validation_error_handler)

for router in (
    auth_router,
    projects_router,
    discovery_router,
    library_router,
    analysis_router,
    billing_router,
    ai_router,
    ai_features_router,
    documents_router,
    quant_router,
):
    app.include_router(router, prefix=settings.api_prefix)


@app.get("/livez", tags=["system"])
async def livez() -> dict[str, str]:
    """Liveness probe; does not depend on database availability."""
    return {"status": "ok"}


@app.get("/healthz", tags=["system"])
async def healthz() -> JSONResponse:
    """Readiness probe; confirms the database can execute a trivial query."""
    try:
        async with engine.connect() as conn:
            await conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})
    return JSONResponse(content={"status": "ok", "database": "ok"})


@app.get(f"{settings.api_prefix}/", tags=["system"])
async def api_root() -> dict[str, str]:
    return {"name": "ResearchForge", "status": "ok", "version": app.version}
