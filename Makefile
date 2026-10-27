.PHONY: migrate test lint seed
migrate:
	cd backend && alembic upgrade head
test:
	cd backend && pytest
lint:
	cd backend && ruff check app tests && mypy app
seed:
	cd backend && python -m app.seed
