"""Persist explicit Premium AI feature results."""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0006_ai_results"
down_revision = "0005_subscriptions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ai_results",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("project_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("paper_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("library_papers.id", ondelete="CASCADE"), nullable=True),
        sa.Column("feature", sa.String(40), nullable=False),
        sa.Column("provider", sa.String(40), nullable=False),
        sa.Column("model", sa.String(200), nullable=False),
        sa.Column("result_json", sa.Text(), nullable=False),
        sa.Column("reasoning", sa.Text(), nullable=False, server_default=""),
        sa.Column("evidence_json", sa.Text(), nullable=False, server_default="[]"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    for col in ("project_id", "user_id", "paper_id", "feature"):
        op.create_index(f"ix_ai_results_{col}", "ai_results", [col])


def downgrade() -> None:
    for col in ("feature", "paper_id", "user_id", "project_id"):
        op.drop_index(f"ix_ai_results_{col}", table_name="ai_results")
    op.drop_table("ai_results")
