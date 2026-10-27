# Known limitations (integrated frontend/backend snapshot)

The React frontend is wired to the implemented API routes for authentication, project CRUD, project membership, discovery/import, PDF upload/extraction, comparisons, gap notes, premium AI actions, subscription status, document view, and PDF/DOCX export. API/database integration still needs to be run in a Docker environment with PostgreSQL and migrations applied.

## Product and backend limitations

- Scanned or image-only PDFs are not OCR-processed; extraction supports selectable PDF text.
- Billing is entitlement state only. No checkout, invoices, payment processor, or provider webhooks are included. The Premium activation endpoint exists for local development only and is unavailable outside `APP_ENV=development`.
- The fake AI provider is deterministic/offline and does not perform real AI inference. Live provider calls require configured credentials and may incur provider charges.
- AI summaries require extracted PDF text. AI Q&A uses bounded lexical sentence matching, not pgvector embeddings. Citation analysis uses stored metadata and does not fetch citation counts or build a citation graph. Recommendations do not search/rerank new candidates through discovery adapters.
- AI-generated gaps preserve a structured `gaps` array when the configured provider returns valid JSON in the requested shape. Providers that return plain prose do not produce selectable structured gap records; those results can still be saved as freeform notes. The recommendations endpoint allows an empty `paper_ids` list to mean all papers in the project.
- Project membership is equal-access: no roles or owner/admin permissions are implemented. The backend allows a member to remove only themselves; the final member cannot leave without deleting the project.
- Documents are template-generated from persisted project data; document generation itself does not call an LLM. References are a lightweight numbered list, not a citation-style engine.
- PDF export uses WeasyPrint and depends on system libraries being available in the runtime. DOCX export uses `python-docx`.
- No rate limiter, email verification, password reset, token refresh/revocation, or production-grade abuse throttling is included.
- The bundled Compose database credentials and exposed development ports are for local use only.

## Verification status in this execution environment

- Frontend TypeScript check: passed (`tsc --noEmit -p tsconfig.json`).
- Selected backend unit tests: 22 passed (schema, billing-entitlement, document-renderer, PDF-extraction, provider, and security-hardening tests).
- Full backend test collection could not run because the execution environment lacks `asyncpg`, required to instantiate the configured PostgreSQL async engine.
- A full Vite bundle could not be built here because the ZIP's bundled `node_modules` contains the macOS Rollup native package rather than the Linux optional binary. An attempt to reinstall dependencies was blocked by registry DNS failures (`EAI_AGAIN`). Run `npm ci && npm run build` on the target Mac or in network-enabled CI.
- Docker Compose, PostgreSQL migrations, live API-provider calls, and browser end-to-end flows were not executed here. Verify these before treating the snapshot as release-ready.
