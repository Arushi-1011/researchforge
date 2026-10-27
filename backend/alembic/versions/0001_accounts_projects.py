"""Create user, refresh token, project and membership tables.

Revision ID: 0001_accounts_projects
"""
from alembic import op
import sqlalchemy as sa
revision="0001_accounts_projects";down_revision=None;branch_labels=None;depends_on=None
def upgrade():
 op.create_table("users",sa.Column("id",sa.Uuid(),primary_key=True),sa.Column("email",sa.String(320),nullable=False),sa.Column("password_hash",sa.String(255),nullable=False),sa.Column("display_name",sa.String(120),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False));op.create_index("ix_users_email","users",["email"],unique=True)
 op.create_table("refresh_tokens",sa.Column("id",sa.Uuid(),primary_key=True),sa.Column("user_id",sa.Uuid(),sa.ForeignKey("users.id",ondelete="CASCADE"),nullable=False),sa.Column("token_hash",sa.String(64),nullable=False),sa.Column("expires_at",sa.DateTime(timezone=True),nullable=False),sa.Column("revoked_at",sa.DateTime(timezone=True)));op.create_index("ix_refresh_tokens_user_id","refresh_tokens",["user_id"]);op.create_index("ix_refresh_tokens_token_hash","refresh_tokens",["token_hash"],unique=True)
 op.create_table("projects",sa.Column("id",sa.Uuid(),primary_key=True),sa.Column("name",sa.String(120),nullable=False),sa.Column("description",sa.Text(),nullable=False),sa.Column("created_by",sa.Uuid(),sa.ForeignKey("users.id",ondelete="CASCADE"),nullable=False),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False),sa.Column("updated_at",sa.DateTime(timezone=True),nullable=False));op.create_index("ix_projects_created_by","projects",["created_by"])
 op.create_table("project_members",sa.Column("project_id",sa.Uuid(),sa.ForeignKey("projects.id",ondelete="CASCADE"),primary_key=True),sa.Column("user_id",sa.Uuid(),sa.ForeignKey("users.id",ondelete="CASCADE"),primary_key=True),sa.Column("created_at",sa.DateTime(timezone=True),nullable=False));op.create_index("ix_project_members_user_id","project_members",["user_id"])
def downgrade():
 op.drop_table("project_members");op.drop_index("ix_projects_created_by",table_name="projects");op.drop_table("projects");op.drop_index("ix_refresh_tokens_token_hash",table_name="refresh_tokens");op.drop_index("ix_refresh_tokens_user_id",table_name="refresh_tokens");op.drop_table("refresh_tokens");op.drop_index("ix_users_email",table_name="users");op.drop_table("users")
