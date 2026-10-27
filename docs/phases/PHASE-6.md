# Phase 6 — Premium Gate and AI Provider Foundation

## Scope

This phase establishes server-enforced Premium entitlements and a small AI provider interface. It does not implement payment collection, a production subscription checkout, a frontend upgrade screen, or AI-generated comparison/gap analysis.

## Included

- `subscriptions` table and Alembic revision `0005_subscriptions`.
- `GET /api/v1/billing/subscription` to inspect the authenticated user's plan.
- `POST /api/v1/billing/dev/activate-premium` as a local-development-only test helper. It returns 404 unless `APP_ENV=development`; it is not a payment mechanism.
- Premium-gated `POST /api/v1/projects/{project_id}/ai/papers/{paper_id}/summary`.
- Provider adapter supporting `LLM_PROVIDER=fake`, `openai`, or `anthropic`.
- OpenAI/Anthropic API keys and model names are environment settings; no credentials are committed.
- The fake provider is explicitly marked as an offline excerpt, not an AI-generated summary.
- AI input is capped at 24,000 characters, requests use bounded HTTP timeouts, and provider failures return a sanitized 502.
- The AI route checks project membership, subscription entitlement, paper ownership within the project, and extraction availability.

## Local setup

1. Merge the new `.env.example` settings into your existing `.env` if needed; keep secrets local.
2. Keep `LLM_PROVIDER=fake` for a no-cost offline smoke test. Set `APP_ENV=development` for the local-only Premium test helper.
3. Run `docker compose up --build -d`.
4. Run `docker compose exec api alembic upgrade head`.
5. Use Swagger to register/login, call `POST /api/v1/billing/dev/activate-premium`, then call the paper summary endpoint for a paper with extracted text.
6. For a real provider, configure `LLM_PROVIDER=openai` plus `OPENAI_API_KEY`, or `LLM_PROVIDER=anthropic` plus `ANTHROPIC_API_KEY`. Provider usage may incur charges.

## Endpoints

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/api/v1/billing/subscription` | Creates a FREE subscription record if absent and returns entitlement state |
| POST | `/api/v1/billing/dev/activate-premium` | Development-only local testing; unavailable outside development |
| POST | `/api/v1/projects/{project_id}/ai/papers/{paper_id}/summary` | Premium-only summary; requires extracted paper text |

## Limitations / security notes

- There is no billing provider, checkout, webhook, or self-service paid upgrade. Do not deploy the development activation route in a production environment; it is explicitly blocked unless `APP_ENV=development`.
- The fake provider only returns a bounded text excerpt and is not a substitute for an LLM.
- Summary responses are not persisted in this phase.
- AI output can be inaccurate; the API includes a verification disclaimer.
- Full Docker/PostgreSQL integration tests and real provider smoke tests must be run in the target environment.
