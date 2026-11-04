#!/bin/sh
# Wait for the database to be reachable, then run Alembic migrations
# and start the API server. This runs as the non-root 'app' user.
set -e

echo "[entrypoint] Running Alembic migrations..."
alembic upgrade head

echo "[entrypoint] Starting API server..."
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
