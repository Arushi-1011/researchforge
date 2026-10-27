# Phase 1 — Accounts, Projects, Teams

## What was built
Registration, login, `/auth/me`, signed access JWTs, Argon2 password hashing, project CRUD, project membership listing/inviting/removing, and SQLAlchemy entities plus an Alembic migration.

## Why this design
A single `ProjectMember` join table represents equal membership. It intentionally has no role column. Every project route resolves membership first and returns 404 for non-members to avoid disclosing project existence. Access tokens are stateless; refresh-token storage is modeled for the planned rotation flow.

## Key files
- `backend/app/modules/users/models.py`
- `backend/app/modules/users/router.py`
- `backend/app/modules/projects/models.py`
- `backend/app/modules/projects/router.py`
- `backend/app/core/security.py`
- `backend/app/core/deps.py`
- `backend/alembic/versions/0001_accounts_projects.py`

## Data flow (5 lines)
1. Register validates input and hashes the password.
2. Login fetches the account by normalized email and verifies the hash.
3. A successful login returns a signed access JWT.
4. Protected routes decode the JWT and resolve the user.
5. Project endpoints check the membership join before reading or mutating project data.

## Interview questions
**Why hash passwords?** So a database leak does not expose plaintext credentials; Argon2 is deliberately costly to slow guessing.

**Why a join table?** A project can have multiple users and each user can join multiple projects; the composite key prevents duplicate memberships.

**Why return 404 for non-members?** It prevents an unauthorized caller from distinguishing a real project ID from a nonexistent one.
