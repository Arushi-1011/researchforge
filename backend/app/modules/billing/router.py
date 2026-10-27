"""Subscription status and safe development-only premium testing route."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.config import settings
from app.core.db import get_db
from app.core.deps import get_current_user
from app.modules.billing.models import Subscription
from app.modules.billing.schemas import SubscriptionOut
from app.modules.billing.service import get_subscription, is_premium
from app.modules.users.models import User

router = APIRouter(prefix="/billing", tags=["billing"])


@router.get("/subscription", response_model=SubscriptionOut)
async def subscription_status(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> SubscriptionOut:
    subscription = await get_subscription(db, user)
    await db.commit()
    return SubscriptionOut(plan=subscription.plan, status=subscription.status, premium=is_premium(subscription),
                           started_at=subscription.started_at, expires_at=subscription.expires_at)


@router.post("/dev/activate-premium", response_model=SubscriptionOut)
async def activate_premium_for_local_testing(db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)) -> SubscriptionOut:
    """Local test helper only; deliberately unavailable outside development."""
    if settings.app_env.lower() != "development":
        raise HTTPException(status_code=404, detail="Not found")
    subscription = await get_subscription(db, user)
    subscription.plan = "PREMIUM"
    subscription.status = "ACTIVE"
    await db.commit()
    await db.refresh(subscription)
    return SubscriptionOut(plan=subscription.plan, status=subscription.status, premium=is_premium(subscription),
                           started_at=subscription.started_at, expires_at=subscription.expires_at)
