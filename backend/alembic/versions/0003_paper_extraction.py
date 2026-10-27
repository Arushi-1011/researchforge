"""Persist extracted PDF text and extraction metadata."""
from alembic import op
import sqlalchemy as sa

revision = "0003_paper_extraction"
down_revision = "0002_library_papers"
branch_labels = None
depends_on = None

def upgrade() -> None:
    op.add_column("library_papers", sa.Column("extracted_text", sa.Text(), nullable=True))
    op.add_column("library_papers", sa.Column("extraction_status", sa.String(length=20), nullable=False, server_default="pending"))
    op.add_column("library_papers", sa.Column("page_count", sa.Integer(), nullable=True))
    op.add_column("library_papers", sa.Column("extracted_at", sa.DateTime(timezone=True), nullable=True))

def downgrade() -> None:
    op.drop_column("library_papers", "extracted_at")
    op.drop_column("library_papers", "page_count")
    op.drop_column("library_papers", "extraction_status")
    op.drop_column("library_papers", "extracted_text")
