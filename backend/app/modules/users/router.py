
"""Registration, login, and current-user endpoints."""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_db
from app.core.security import hash_password, verify_password, create_access_token, create_refresh_token, hash_token
from app.core.deps import get_current_user
from app.modules.users.models import User, RefreshToken
from app.modules.projects.models import ProjectMember
from app.modules.users.schemas import RegisterIn, LoginIn

router = APIRouter(prefix="/auth", tags=["auth"])


class RefreshIn(BaseModel):
    refresh_token: str


@router.post("/register", status_code=201)
async def register(data: RegisterIn, db: AsyncSession = Depends(get_db)):
    email = str(data.email).lower().strip()

    if (
        len(data.password) < 8
        or not any(c.isalpha() for c in data.password)
        or not any(c.isdigit() for c in data.password)
    ):
        raise HTTPException(
            status_code=422,
            detail="Password must be at least 8 characters and include a letter and digit",
        )

    existing_user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()

    if existing_user:
        raise HTTPException(status_code=409, detail="Email is already registered")

    user = User(
        email=email,
        password_hash=hash_password(data.password),
        display_name=data.display_name.strip(),
    )
    db.add(user)
    await db.flush()
    await db.commit()

    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
    }


@router.post("/login")
async def login(data: LoginIn, db: AsyncSession = Depends(get_db)):
    email = str(data.email).lower().strip()

    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access_token = create_access_token(str(user.id))
    raw_token, token_hash, expiry = create_refresh_token(str(user.id))
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expiry))
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_token,
        "token_type": "bearer",
    }


@router.post("/login/oauth")
async def login_oauth(
    data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    email = data.username.lower().strip()

    user = (
        await db.execute(select(User).where(User.email == email))
    ).scalar_one_or_none()

    if user is None or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Incorrect email or password")

    access_token = create_access_token(str(user.id))
    raw_token, token_hash, expiry = create_refresh_token(str(user.id))
    db.add(RefreshToken(user_id=user.id, token_hash=token_hash, expires_at=expiry))
    await db.commit()

    return {
        "access_token": access_token,
        "refresh_token": raw_token,
        "token_type": "bearer",
    }


@router.post("/refresh")
async def refresh_token(data: RefreshIn, db: AsyncSession = Depends(get_db)):
    token_hash = hash_token(data.refresh_token)
    record = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash))
    ).scalar_one_or_none()

    now = datetime.now(timezone.utc)
    if record is None or record.revoked_at is not None or record.expires_at.replace(tzinfo=timezone.utc) < now:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    return {
        "access_token": create_access_token(str(record.user_id)),
        "token_type": "bearer",
    }


@router.post("/logout")
async def logout(data: RefreshIn, db: AsyncSession = Depends(get_db), user: User = Depends(get_current_user)):
    token_hash = hash_token(data.refresh_token)
    record = (
        await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_hash, RefreshToken.user_id == user.id))
    ).scalar_one_or_none()

    if record is not None and record.revoked_at is None:
        record.revoked_at = datetime.now(timezone.utc)
        await db.commit()

    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)):
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
    }

