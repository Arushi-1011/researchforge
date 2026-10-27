# Security & Operations Runbook — Phase 9

## Before production

- Set `APP_ENV=production` and a unique random `JWT_SECRET` of at least 32 characters. Startup fails if the secret is still the development default or the frontend origin is blank/wildcard.
- Set `FRONTEND_ORIGIN` to the exact HTTPS origin of the deployed frontend. Do not use `*` with credentials.
- Keep `.env`, database dumps, uploaded research files, and provider keys out of Git. Rotate any key that was ever committed or shared.
- Put the API behind HTTPS at a trusted reverse proxy. Configure proxy headers only when the proxy is trusted; do not trust arbitrary client-supplied forwarded headers.
- Keep `/docs`, `/redoc`, and `/openapi.json` disabled in production (currently automatic when `APP_ENV=production`).
- Run migrations as a controlled deployment step, not concurrently from every API replica.
- Back up PostgreSQL and uploaded files, encrypt backups, restrict access, and periodically test restoration.
- Review LLM-provider retention and data processing terms before sending private manuscripts to a third party.
- Run dependency and secret scanning in CI; review findings and pin/update vulnerable dependencies.

## Implemented in this phase

- Defensive response headers: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, and `Cache-Control`.
- Request identifier propagation via `X-Request-ID`; invalid or oversized identifiers are replaced with a generated UUID.
- Separate `/livez` and database-backed `/healthz` probes; readiness returns 503 without exposing internal exception details.
- Production configuration guard for the JWT secret and CORS origin.
- Docker image runs as a non-root user.
- CI security scan for Python dependencies and tests for security configuration/middleware.

## Known gaps — do not interpret this as a security certification

- In-memory rate limiting, distributed throttling, refresh-token rotation/revocation flows, email verification, password reset, audit events, and automated secret scanning are not implemented by this phase.
- The database compose service still uses development credentials and publishes its port for local development. Replace credentials, remove public database port exposure, and use managed secrets/network isolation for deployment.
- `Cache-Control: no-store` is intentionally conservative; tune only after reviewing sensitive API responses.
- CORS is origin-based, not a replacement for authentication or authorization. Continue enforcing project membership at every resource endpoint.
- This project has not undergone an external penetration test. Run full integration tests and review authorization edge cases before production use.

## Incident checklist

1. Disable affected credentials/API keys and rotate secrets.
2. Preserve relevant application/proxy/database logs without exposing manuscript contents or tokens.
3. Identify affected accounts/projects and revoke sessions where supported.
4. Restore from a verified clean backup if data integrity is affected.
5. Document timeline, scope, mitigation, and follow-up tests.
