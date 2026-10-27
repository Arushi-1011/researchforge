from datetime import datetime
from pydantic import BaseModel


class SubscriptionOut(BaseModel):
    plan: str
    status: str
    premium: bool
    started_at: datetime
    expires_at: datetime | None
