# Phase 3 — Import and Upload

## Implemented
- Project-member scoped paper library listing.
- Import normalized discovery metadata into a project library.
- Duplicate detection for provider/source IDs within the same project.
- PDF upload with extension, content-type, PDF signature and 25 MB checks.
- Randomized storage filenames to avoid trusting user-supplied paths.
- Database migration `0002_library_papers` and documentation.

## API
- `GET /api/v1/projects/{project_id}/library`
- `POST /api/v1/projects/{project_id}/library/import`
- `POST /api/v1/projects/{project_id}/library/upload` (multipart `file`)

All endpoints require bearer authentication and project membership. PDFs are currently stored in local `backend/storage/uploads`; production deployments should move this to private object storage and add malware scanning/retention controls.
