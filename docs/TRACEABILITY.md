# Backend-to-frontend traceability

This snapshot connects the interactive frontend to each user-facing API route in the backend. The API prefix defaults to `/api/v1` and can be changed with `API_PREFIX`; the frontend defaults to the same prefix and can be overridden with `VITE_API_BASE`.

| Capability | Backend routes | Frontend entry point | Notes |
|---|---|---|---|
| Account registration and login | `POST /auth/register`, `POST /auth/login`, `POST /auth/login/oauth`, `GET /auth/me` | Login / register screen, Team, Settings | The browser stores the bearer token locally. Sign-out clears it locally; the API has no remote logout or token-revocation route. |
| Project workspaces | `GET/POST /projects`, `GET/PATCH/DELETE /projects/{project_id}` | Overview, My projects | Project name limits are aligned with the API schema. |
| Project membership | `GET/POST /projects/{project_id}/members`, `DELETE /projects/{project_id}/members/{user_id}` | Team | Invitations add an already-registered user. Members have equal access; only self-removal is supported. |
| Paper discovery | `POST /discovery/search` | Discover papers | Search is performed through the configured arXiv and Semantic Scholar adapters; source warnings are surfaced. |
| Library and PDF extraction | `GET /projects/{project_id}/library`, `POST .../library/import`, `POST .../library/upload`, `POST .../library/{paper_id}/extract`, `GET .../library/{paper_id}/extraction` | Discover papers, Library | PDF upload is limited to 25 MB. Extraction is for selectable PDF text; OCR is not implemented. |
| Metadata comparisons | `POST/GET /projects/{project_id}/comparisons`, `GET/DELETE /projects/{project_id}/comparisons/{comparison_id}` | Comparisons & gaps | The matrix uses saved paper metadata and leaves missing fields blank rather than inferring them. |
| Research-gap notes | `POST/GET /projects/{project_id}/gaps`, `PATCH/DELETE /projects/{project_id}/gaps/{gap_id}` | Comparisons & gaps; AI research | Supports open/addressed state, optional comparison association, and note CRUD. |
| AI paper summary | `POST /projects/{project_id}/ai/papers/{paper_id}/summary` | AI research | Premium-gated; requires extracted PDF text. |
| AI research features | `POST /projects/{project_id}/ai/gaps`, `/ai/gaps/save`, `/ai/compare`, `/ai/recommendations`, `/ai/citations`, `/ai/qa` | AI research | Premium-gated. Structured gap saving is available when the provider returns valid JSON with a `gaps` array; freeform output can be saved as a note. Recommendations and Q&A can use all project papers when no paper IDs are supplied. |
| Subscription / development entitlement | `GET /billing/subscription`, `POST /billing/dev/activate-premium` | Settings; AI research upgrade notice | There is no checkout/payment processor. The activation route is intentionally unavailable outside `APP_ENV=development`. |
| Research reports | `POST/GET /projects/{project_id}/documents`, `GET /projects/{project_id}/documents/{document_id}`, `GET .../view`, `GET .../export.pdf`, `GET .../export.docx` | Documents | Reports are generated from stored project data. PDF export requires compatible WeasyPrint system libraries. |
| Operational health | `GET /livez`, `GET /healthz`, `GET /api/v1/` | Operations only (not a UI screen) | `/healthz` checks database connectivity; these endpoints are not interactive research features. |

## Verification in this build environment

- Frontend strict TypeScript check: passed (`npm run lint`, implemented as `tsc --noEmit -p tsconfig.json`).
- Backend syntax compilation: passed (`python -m compileall -q app`).
- Selected backend unit tests: 22 passed.
- Frontend test execution and Vite bundling could not be completed in this container because the supplied `node_modules` contains the macOS Rollup native binary, not the Linux binary. Reinstalling dependencies was blocked by package-registry DNS failures. The clean archive excludes `node_modules`; run `npm ci`, `npm run build`, `npm test`, and `npm run lint` on the target machine or CI.
- Full backend test collection, migrations, Docker Compose, live provider calls, and browser end-to-end tests were not executed here. The runtime environment needs `asyncpg`, a running PostgreSQL instance, applied migrations, and provider credentials for live AI usage.
