# Phase 8 — Documents & Export

## What was built
- Added persistent project documents generated from project metadata, library papers, comparisons, gap notes, and optionally saved AI results.
- Added configurable sections and ordering.
- Added an authenticated HTML view and PDF/DOCX download endpoints.
- Added a database migration and documented endpoints.

## Why this design
One normalized content structure feeds all renderers, preventing the HTML, PDF, and DOCX exports from disagreeing. HTML uses Jinja autoescaping; document generation is template-based and works for Free users. AI insights are included only when explicitly requested and previously saved.

## Key files
1. `backend/app/modules/documents/models.py`
2. `backend/app/modules/documents/schemas.py`
3. `backend/app/modules/documents/renderers.py`
4. `backend/app/modules/documents/router.py`
5. `backend/alembic/versions/0007_project_documents.py`
6. `backend/app/main.py`
7. `docs/TRACEABILITY.md`
8. `docs/KNOWN_LIMITATIONS.md`

## Data flow (5 lines)
1. A project member requests a document and selects sections.
2. The API gathers stored project, paper, comparison, and gap data; AI results are queried only if include_ai is true.
3. A normalized JSON document is persisted.
4. The view endpoint renders escaped HTML from that saved structure.
5. PDF and DOCX endpoints render the same saved structure and return attachment downloads.

## Interview questions
**Q: Why use one document structure for three formats?**  
A: It keeps content consistent while letting each output format have its own renderer.

**Q: Does document generation call an LLM?**  
A: No. It is template-based. Existing AI insights are included only when requested.

**Q: How is generated HTML protected from injection?**  
A: Jinja autoescaping is enabled, and user-supplied content is rendered as text rather than trusted markup.
