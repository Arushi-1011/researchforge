"""User accounts and refresh-token persistence."""
import uuid
from datetime import datetime, timezone
from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column
from app.core.db import Base

def utcnow() -> datetime: return datetime.now(timezone.utc)
class User(Base):
 __tablename__="users"
 id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
 email: Mapped[str]=mapped_column(String(320),unique=True,index=True)
 password_hash: Mapped[str]=mapped_column(String(255))
 display_name: Mapped[str]=mapped_column(String(120))
 created_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow)
 updated_at: Mapped[datetime]=mapped_column(DateTime(timezone=True),default=utcnow,onupdate=utcnow)
class RefreshToken(Base):
 __tablename__="refresh_tokens"
 id: Mapped[uuid.UUID]=mapped_column(primary_key=True,default=uuid.uuid4)
 user_id: Mapped[uuid.UUID]=mapped_column(ForeignKey("users.id",ondelete="CASCADE"),index=True)
 token_hash: Mapped[str]=mapped_column(String(64),unique=True)
 expires_at: Mapped[datetime]=mapped_column(DateTime(timezone=True))
 revoked_at: Mapped[datetime|None]=mapped_column(DateTime(timezone=True),nullable=True)
