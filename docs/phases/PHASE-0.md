# Phase 0 — Foundation

## What was built
Repository scaffold, settings, async SQLAlchemy engine/session, FastAPI app, standardized validation envelope, JSON logging, `/healthz`, Compose services, frontend shell, CI workflow, architecture diagrams, decisions, and baseline test.

## Why this design
The modular monolith keeps deployment simple while enforcing clean boundaries. Settings are environment-driven, DB access is asynchronous, and API errors share a predictable envelope. React/Vite offers a fast local frontend workflow.

## Key files (≤ 8)
- `backend/app/main.py`
- `backend/app/core/config.py`
- `backend/app/core/db.py`
- `backend/app/core/errors.py`
- `docker-compose.yml`
- `frontend/src/App.tsx`
- `docs/ARCHITECTURE.md`
- `docs/DECISIONS.md`

## Data flow (5 lines)
1. Browser loads the React SPA from Vite.
2. The SPA sends API requests to FastAPI under `/api/v1`.
3. FastAPI reads configuration from environment variables.
4. Database work uses a request-scoped async SQLAlchemy session.
5. Health check executes a simple DB query and reports service status.

## Interview questions
**Why a modular monolith?** It avoids distributed-system overhead while keeping domain boundaries explicit.

**Why SQLAlchemy async?** The API can await database I/O without blocking the event loop during concurrent requests.

**Why a shared error envelope?** Client code can handle errors consistently and users receive understandable messages without internal stack traces.
