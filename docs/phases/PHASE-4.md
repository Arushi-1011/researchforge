# Phase 4 — PDF Text Extraction

## Scope
Phase 4 extracts selectable text from PDFs already uploaded to a project's library and persists the result for later research analysis. It does not claim OCR support for scanned/image-only PDFs.

## Implemented
- PyMuPDF-based text extraction from stored PDF uploads.
- Project membership and project/paper ownership checks before extraction or reading extracted text.
- Path resolution constrained to the upload root to prevent path traversal.
- Persistence of extracted text, page count, extraction status, and timestamp.
- Limits of 500 pages and 5,000,000 extracted characters to bound resource use.
- Clear errors for non-PDF, unreadable, encrypted, empty, or image-only/scanned PDFs.
- Alembic migration `0003_paper_extraction`.
- Unit tests for valid PDFs, invalid bytes, and image-only/no-text PDFs.

## API
- `POST /api/v1/projects/{project_id}/library/{paper_id}/extract` — extract and return text.
- `GET /api/v1/projects/{project_id}/library/{paper_id}/extraction` — retrieve previously extracted text.
- `GET /api/v1/projects/{project_id}/library` now includes `extraction_status`, `page_count`, and `extracted_at` for each paper.

Both new endpoints require bearer authentication and project membership. The PDF must have been uploaded through the Phase 3 upload endpoint. The upload storage path uses the configured `STORAGE_DIR` (default `/app/storage` in Docker). Metadata-only imported papers without a stored PDF return `422`.

## Run / migrate
From the project root, run `docker compose exec api alembic upgrade head`, then restart the API if necessary. Tests run in the backend environment with `pytest`.

## Limitations
- No OCR; scanned PDFs need OCR support in a later increment.
- Extraction is synchronous and returns extracted text in the response; large documents may be better handled by a background job later.
- Extracted text is stored in PostgreSQL; production deployments should consider retention and document privacy policies.
