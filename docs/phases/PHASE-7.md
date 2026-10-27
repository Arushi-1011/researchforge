# Phase 7 — AI Features

## What was built
- Added persisted `ai_results` records for explicit Premium requests.
- Added Premium-gated endpoints for research-gap analysis, AI comparison, recommendations, citation metadata analysis, and grounded Q&A.
- Added a common OpenAI/Anthropic/Fake provider helper with bounded request timeouts.
- Added an endpoint to save structured AI gap results as ordinary research-gap notes.
- Kept the existing paper-summary endpoint compatible.
- Q&A uses bounded lexical sentence retrieval and does not generate embeddings or use pgvector in this artifact.

## Why this design
Every request checks project membership and the requesting user's Premium entitlement. AI is invoked only by explicit POST handlers. Results store provider/model, output, reasoning note, and evidence excerpts. The fake provider works offline and clearly labels itself as non-AI.

## Key files
1. `backend/app/modules/ai/features.py`
2. `backend/app/modules/ai/providers.py`
3. `backend/app/modules/ai/models.py`
4. `backend/alembic/versions/0006_ai_results.py`
5. `backend/app/main.py`
6. `backend/alembic/env.py`
7. `backend/tests/test_ai_features_helpers.py`
8. `docs/TRACEABILITY.md`

## Data flow (5 lines)
1. Client sends an explicit AI POST request with project and selected paper IDs.
2. API verifies membership and the requesting user's Premium subscription.
3. API loads papers belonging to the project and prepares bounded evidence excerpts.
4. Configured provider processes the request; fake provider remains offline and deterministic.
5. API persists the result and evidence, then returns it with a verification disclaimer.

## Interview questions
**Q: Why is Premium checked on every endpoint?**  
A: Frontend locking is only UX; the server must enforce entitlements for every AI request.

**Q: Why store evidence with the result?**  
A: It makes outputs auditable and helps users verify whether a claim is supported by their papers.

**Q: Does Q&A use vector search yet?**  
A: Not in this artifact. It uses bounded lexical sentence ranking; pgvector retrieval remains outstanding.
