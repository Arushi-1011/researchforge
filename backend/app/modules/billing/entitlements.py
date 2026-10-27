"""Pure subscription-entitlement logic, kept independent for fast unit testing."""
from datetime import datetime, timezone
from typing import Any


def is_premium(subscription: Any | None) -> bool:
    if subscription is None or subscription.plan != "PREMIUM" or subscription.status != "ACTIVE":
        return False
    expires_at = subscription.expires_at
    if expires_at is not None:
        if expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)
        if expires_at <= datetime.now(timezone.utc):
            return False
    return True
