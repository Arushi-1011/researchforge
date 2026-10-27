"""Centralized entitlement checks. All premium decisions are enforced server-side."""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.billing.models import Subscription
from app.modules.users.models import User

from app.modules.billing.entitlements import is_premium


async def get_subscription(db: AsyncSession, user: User) -> Subscription:
    result = await db.execute(select(Subscription).where(Subscription.user_id == user.id))
    subscription = result.scalar_one_or_none()
    if subscription is None:
        subscription = Subscription(user_id=user.id, plan="FREE", status="ACTIVE")
        db.add(subscription)
        await db.flush()
    return subscription
