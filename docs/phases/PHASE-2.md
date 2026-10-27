# Phase 2 — Discovery

## What was built
- Normalized `PaperResult` and search request/response schemas.
- arXiv Atom API and Semantic Scholar Graph API adapters.
- Authenticated `POST /api/v1/discovery/search`.
- Parallel source retrieval, bounded retry/timeout, short-lived in-process cache, deduplication, and source-level warnings.
- Basic schema tests.

## Why this design
Adapters isolate provider-specific formats from the application contract. Partial source outages return usable results and warnings rather than discarding successful providers. Cache is intentionally process-local for the initial iteration; a shared cache is a later operational improvement.

## Key files
- `backend/app/modules/discovery/schemas.py`
- `backend/app/modules/discovery/adapters.py`
- `backend/app/modules/discovery/router.py`
- `backend/app/main.py`
- `backend/tests/test_discovery_schemas.py`

## Data flow
1. Authenticated client submits a query, sources, and result limit.
2. API validates input and checks the TTL cache.
3. Selected source adapters call their official APIs concurrently.
4. Provider records are normalized and deduplicated.
5. API returns normalized records with warnings for failed providers.

## Interview questions
**Why use adapters?** Provider-specific payloads stay separate from application logic.
**Why gather concurrently?** Independent network calls reduce combined response latency.
**Why return warnings?** One source failing should not erase valid results from another.
