"""Add RBAC role to project_members, pgvector extension, and paper embeddings.

Revision ID: 0008_rbac_vector
"""
from alembic import op
import sqlalchemy as sa

revision = "0008_rbac_vector"
down_revision = "0007_project_documents"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 1. RBAC: add role column to project_members (default OWNER for existing rows)
    op.add_column(
        "project_members",
        sa.Column("role", sa.String(20), nullable=False, server_default="OWNER"),
    )

    # 2. pgvector: enable extension (requires pgvector to be installed in Postgres)
    #    We use a try/except so the migration doesn't hard-fail on Postgres instances
    #    without pgvector installed (e.g., CI with vanilla Postgres).
    connection = op.get_bind()
    try:
        connection.execute(sa.text("CREATE EXTENSION IF NOT EXISTS vector"))
        # Add 384-dim embedding column (sentence-transformers all-MiniLM-L6-v2 output)
        connection.execute(
            sa.text(
                "ALTER TABLE library_papers "
                "ADD COLUMN IF NOT EXISTS embedding vector(384)"
            )
        )
        connection.execute(
            sa.text(
                "CREATE INDEX IF NOT EXISTS ix_library_papers_embedding "
                "ON library_papers USING ivfflat (embedding vector_cosine_ops) "
                "WITH (lists = 10)"
            )
        )
    except Exception:
        # pgvector not available — skip vector columns; lexical Q&A still works
        pass


def downgrade() -> None:
    # Drop vector index and column if they exist
    connection = op.get_bind()
    try:
        connection.execute(sa.text("DROP INDEX IF EXISTS ix_library_papers_embedding"))
        connection.execute(sa.text("ALTER TABLE library_papers DROP COLUMN IF EXISTS embedding"))
    except Exception:
        pass

    op.drop_column("project_members", "role")
