# Implementation decisions

- Phase 1 authentication currently issues short-lived signed access JWTs. Refresh-token model exists; rotation, secure cookie handling, reuse detection, and rate limiting remain hardening work.
- Billing/subscription rows will be introduced in Phase 6 per implementation brief; account signup is not yet coupled to billing.
- Team membership has equal permissions, no role field, and allows only self-removal. A project’s final member cannot leave.
- Full requirements and TBD resolutions are retained from the supplied implementation brief. See `docs/KNOWN_LIMITATIONS.md` for current phase scope.
