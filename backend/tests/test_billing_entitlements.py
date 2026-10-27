from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from app.modules.billing.entitlements import is_premium


def test_missing_subscription_is_not_premium():
    assert is_premium(None) is False


def test_free_subscription_is_not_premium():
    assert is_premium(SimpleNamespace(plan="FREE", status="ACTIVE", expires_at=None)) is False


def test_active_premium_subscription_is_premium():
    assert is_premium(SimpleNamespace(plan="PREMIUM", status="ACTIVE", expires_at=None)) is True


def test_cancelled_or_expired_subscription_is_not_premium():
    cancelled = SimpleNamespace(plan="PREMIUM", status="CANCELLED", expires_at=None)
    expired = SimpleNamespace(plan="PREMIUM", status="ACTIVE", expires_at=datetime.now(timezone.utc)-timedelta(days=1))
    assert is_premium(cancelled) is False
    assert is_premium(expired) is False
