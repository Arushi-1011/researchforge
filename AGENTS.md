# Agent and contributor rules

- Follow `docs/SRS.docx` and the implementation brief; document conflicts in `docs/DECISIONS.md`.
- Dependency direction: routers -> services -> repositories/models. AI must remain isolated from non-AI modules.
- AI is never invoked on import, extraction, GET, or background processing. Premium features are explicit POST actions.
- No credentials in source control. Copy `.env.example` to `.env` for local use.
- Backend: `cd backend && pip install -e '.[dev]'`; run `uvicorn app.main:app --reload`, `pytest`, `ruff check app tests`, `mypy app`.
- Frontend: `cd frontend && npm install`; run `npm run dev`, `npm run build`, `npm test`, `npm run lint`.
- Docker: `docker compose up --build`; migration command `docker compose exec api alembic upgrade head`.
- Use recorded fixtures for external sources and FakeLLM for tests; never call live APIs in CI.
