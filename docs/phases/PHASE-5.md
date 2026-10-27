# Phase 5 — Compare & Gaps

## What was built
- Authenticated project-scoped endpoints to save, list, inspect, and delete paper comparisons.
- Comparisons require at least two distinct papers, all from the same project.
- A deterministic side-by-side metadata matrix for title, authors, year, abstract, DOI, source, extraction status, and page count.
- User-authored research-gap notes with optional links to a saved comparison, pagination, status filtering, editing, status changes (`OPEN` / `ADDRESSED`), and deletion.
- Alembic migration `0004_compare_gaps` and schema validation tests.
- All comparison and gap endpoints check project membership. The feature performs no LLM or embedding calls.

## Why this design
Comparison values come directly from stored library metadata and extracted-PDF status. Missing fields remain empty instead of being guessed. Research-gap notes are explicitly marked `USER`; AI-generated gap suggestions are deferred to the later AI phase. The two-table comparison design keeps the ordered paper selection separate from comparison metadata.

## Key files
1. `backend/app/modules/analysis/models.py`
2. `backend/app/modules/analysis/schemas.py`
3. `backend/app/modules/analysis/router.py`
4. `backend/alembic/versions/0004_compare_gaps.py`
5. `backend/tests/test_analysis_schemas.py`
6. `backend/app/main.py`
7. `backend/alembic/env.py`
8. `docs/TRACEABILITY.md`

## Data flow
1. A signed-in project member submits a comparison title and at least two paper IDs.
2. The API verifies every paper belongs to the same project, then saves the comparison and ordered paper links in one transaction.
3. A matrix request reads saved library metadata and returns the values without generating inferred claims.
4. A member creates a gap note; the API validates any comparison link belongs to the same project.
5. Members can list, filter, edit, mark addressed, or delete notes; all operations remain project-scoped.

## Interview questions
**Q: Why require two papers for a comparison?**  
A: A comparison needs at least two distinct items to produce meaningful side-by-side differences; the request schema and service validation enforce that.

**Q: How do you avoid hallucinated comparison results?**  
A: Phase 5's matrix is deterministic and reads only stored metadata. AI-generated synthesis is a separate, premium-gated future phase.

**Q: How are project data leaks prevented?**  
A: Every endpoint first verifies membership, and each comparison, paper, and gap lookup is constrained by the requested project ID.

## Verification notes
- Schema-level tests cover minimum paper count, duplicate IDs, whitespace handling, and gap status validation.
- The full backend suite could not be executed in this build environment because `asyncpg` is not installed in the local Python environment. Run the suite inside the project's backend Docker container after migration.
- Apply the schema with `docker compose exec api alembic upgrade head`.
