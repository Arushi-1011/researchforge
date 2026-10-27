"""Add project paper library and PDF upload metadata."""
from alembic import op
import sqlalchemy as sa
revision="0002_library_papers"; down_revision="0001_accounts_projects"; branch_labels=None; depends_on=None
def upgrade():
 op.create_table("library_papers",sa.Column("id",sa.Uuid(),primary_key=True),sa.Column("project_id",sa.Uuid(),sa.ForeignKey("projects.id",ondelete="CASCADE"),nullable=False),sa.Column("imported_by",sa.Uuid(),sa.ForeignKey("users.id",ondelete="CASCADE"),nullable=False),sa.Column("source",sa.String(40),nullable=False),sa.Column("source_id",sa.String(300),nullable=False),sa.Column("title",sa.String(1000),nullable=False),sa.Column("authors",sa.Text(),nullable=False),sa.Column("year",sa.Integer(),nullable=True),sa.Column("abstract",sa.Text(),nullable=False),sa.Column("doi",sa.String(300),nullable=True),sa.Column("landing_url",sa.String(2000),nullable=True),sa.Column("pdf_path",sa.String(1000),nullable=True),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.UniqueConstraint("project_id","source","source_id",name="uq_library_paper_source"));op.create_index("ix_library_papers_project_id","library_papers",["project_id"]);op.create_index("ix_library_papers_imported_by","library_papers",["imported_by"])
def downgrade():
 op.drop_index("ix_library_papers_imported_by",table_name="library_papers");op.drop_index("ix_library_papers_project_id",table_name="library_papers");op.drop_table("library_papers")
