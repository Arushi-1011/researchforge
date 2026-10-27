"""Add saved comparisons and research-gap notes."""
from alembic import op
import sqlalchemy as sa

revision = "0004_compare_gaps"
down_revision = "0003_paper_extraction"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "comparisons",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_comparisons_project_id", "comparisons", ["project_id"])
    op.create_index("ix_comparisons_created_by", "comparisons", ["created_by"])
    op.create_table(
        "comparison_papers",
        sa.Column("comparison_id", sa.Uuid(), sa.ForeignKey("comparisons.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("paper_id", sa.Uuid(), sa.ForeignKey("library_papers.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("position", sa.Integer(), nullable=False, server_default="0"),
        sa.UniqueConstraint("comparison_id", "paper_id", name="uq_comparison_paper"),
    )
    op.create_table(
        "research_gaps",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("project_id", sa.Uuid(), sa.ForeignKey("projects.id", ondelete="CASCADE"), nullable=False),
        sa.Column("comparison_id", sa.Uuid(), sa.ForeignKey("comparisons.id", ondelete="CASCADE"), nullable=True),
        sa.Column("note", sa.Text(), nullable=False),
        sa.Column("status", sa.String(length=20), nullable=False, server_default="OPEN"),
        sa.Column("origin", sa.String(length=20), nullable=False, server_default="USER"),
        sa.Column("created_by", sa.Uuid(), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
    )
    op.create_index("ix_research_gaps_project_id", "research_gaps", ["project_id"])
    op.create_index("ix_research_gaps_comparison_id", "research_gaps", ["comparison_id"])
    op.create_index("ix_research_gaps_created_by", "research_gaps", ["created_by"])


def downgrade() -> None:
    op.drop_index("ix_research_gaps_created_by", table_name="research_gaps")
    op.drop_index("ix_research_gaps_comparison_id", table_name="research_gaps")
    op.drop_index("ix_research_gaps_project_id", table_name="research_gaps")
    op.drop_table("research_gaps")
    op.drop_table("comparison_papers")
    op.drop_index("ix_comparisons_created_by", table_name="comparisons")
    op.drop_index("ix_comparisons_project_id", table_name="comparisons")
    op.drop_table("comparisons")
