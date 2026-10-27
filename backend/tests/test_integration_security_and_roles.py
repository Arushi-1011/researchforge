"""Integration tests for RBAC, token rotation, rate limiting, and workspace isolation."""
from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

try:
    from fastapi import HTTPException
except ImportError:
    class HTTPException(Exception):  # type: ignore
        def __init__(self, status_code: int, detail: object = "", headers: dict | None = None):
            self.status_code = status_code
            self.detail = detail
            self.headers = headers or {}

from app.core.deps import require_owner, require_editor, get_project_for_member
from app.core.ratelimit import SlidingWindowLimiter
from app.core.security import create_access_token, decode_access_token, create_refresh_token, hash_token


class MockUser:
    def __init__(self, user_id: uuid.UUID | None = None, email: str = "test@example.com"):
        self.id = user_id or uuid.uuid4()
        self.email = email
        self.display_name = "Test User"


class MockProject:
    def __init__(self, project_id: uuid.UUID | None = None, owner_id: uuid.UUID | None = None):
        self.id = project_id or uuid.uuid4()
        self.name = "Test Workspace"
        self.description = "A research workspace"
        self.created_by = owner_id or uuid.uuid4()


class MockMembership:
    def __init__(self, project_id: uuid.UUID, user_id: uuid.UUID, role: str = "OWNER"):
        self.project_id = project_id
        self.user_id = user_id
        self.role = role


# ---------------------------------------------------------------------------
# 1. Token Lifecycle & Rotation Tests
# ---------------------------------------------------------------------------

def test_refresh_token_generation_and_hashing():
    uid = str(uuid.uuid4())
    raw_token, token_hash, expiry = create_refresh_token(uid, refresh_token_days=30)
    assert len(raw_token) >= 32
    assert len(token_hash) == 64  # SHA-256 hex digest length
    assert hash_token(raw_token) == token_hash
    assert expiry > datetime.now(timezone.utc)


def test_access_token_decode():
    uid = str(uuid.uuid4())
    token = create_access_token(uid)
    decoded_uid = decode_access_token(token)
    assert decoded_uid == uid


# ---------------------------------------------------------------------------
# 2. RBAC Enforcement Tests (OWNER vs EDITOR vs VIEWER)
# ---------------------------------------------------------------------------

def test_owner_can_access_owner_only_actions():
    project_id = uuid.uuid4()
    owner = MockUser()
    project = MockProject(project_id=project_id, owner_id=owner.id)
    membership = MockMembership(project_id, owner.id, role="OWNER")

    db = AsyncMock()
    # Mock project lookup and membership check
    mock_proj_res = MagicMock()
    mock_proj_res.scalar_one_or_none.return_value = project

    mock_mem_res = MagicMock()
    mock_mem_res.scalar_one_or_none.return_value = membership

    db.execute.side_effect = [mock_proj_res, mock_mem_res]

    loop = asyncio.new_event_loop()
    try:
        res = loop.run_until_complete(require_owner(project_id, owner, db))
        assert res.id == project_id
    finally:
        loop.close()


def test_editor_blocked_from_owner_actions():
    project_id = uuid.uuid4()
    editor = MockUser()
    project = MockProject(project_id=project_id)
    membership = MockMembership(project_id, editor.id, role="EDITOR")

    db = AsyncMock()
    mock_proj_res = MagicMock()
    mock_proj_res.scalar_one_or_none.return_value = project

    mock_mem_res = MagicMock()
    mock_mem_res.scalar_one_or_none.return_value = membership

    db.execute.side_effect = [mock_proj_res, mock_mem_res]

    loop = asyncio.new_event_loop()
    try:
        try:
            loop.run_until_complete(require_owner(project_id, editor, db))
            assert False, "Editor must be rejected from require_owner"
        except HTTPException as exc:
            assert exc.status_code == 403
            assert "owners" in exc.detail
    finally:
        loop.close()


def test_editor_permitted_for_editor_actions():
    project_id = uuid.uuid4()
    editor = MockUser()
    project = MockProject(project_id=project_id)
    membership = MockMembership(project_id, editor.id, role="EDITOR")

    db = AsyncMock()
    mock_proj_res = MagicMock()
    mock_proj_res.scalar_one_or_none.return_value = project

    mock_mem_res = MagicMock()
    mock_mem_res.scalar_one_or_none.return_value = membership

    db.execute.side_effect = [mock_proj_res, mock_mem_res]

    loop = asyncio.new_event_loop()
    try:
        res = loop.run_until_complete(require_editor(project_id, editor, db))
        assert res.id == project_id
    finally:
        loop.close()


def test_viewer_blocked_from_editor_actions():
    project_id = uuid.uuid4()
    viewer = MockUser()
    project = MockProject(project_id=project_id)
    membership = MockMembership(project_id, viewer.id, role="VIEWER")

    db = AsyncMock()
    mock_proj_res = MagicMock()
    mock_proj_res.scalar_one_or_none.return_value = project

    mock_mem_res = MagicMock()
    mock_mem_res.scalar_one_or_none.return_value = membership

    db.execute.side_effect = [mock_proj_res, mock_mem_res]

    loop = asyncio.new_event_loop()
    try:
        try:
            loop.run_until_complete(require_editor(project_id, viewer, db))
            assert False, "Viewer must be rejected from require_editor"
        except HTTPException as exc:
            assert exc.status_code == 403
            assert "read-only" in exc.detail
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# 3. Multi-Tenant Workspace Isolation Tests
# ---------------------------------------------------------------------------

def test_non_member_cannot_access_workspace():
    project_id = uuid.uuid4()
    outsider = MockUser()

    db = AsyncMock()
    mock_proj_res = MagicMock()
    # DB query for membership returns None
    mock_proj_res.scalar_one_or_none.return_value = None
    db.execute.return_value = mock_proj_res

    loop = asyncio.new_event_loop()
    try:
        try:
            loop.run_until_complete(get_project_for_member(project_id, outsider, db))
            assert False, "Non-member must be rejected"
        except HTTPException as exc:
            assert exc.status_code == 404
            assert "not found" in exc.detail.lower()
    finally:
        loop.close()


# ---------------------------------------------------------------------------
# 4. Rate Limiter Tests
# ---------------------------------------------------------------------------

def test_sliding_window_rate_limiter_enforces_capacity():
    limiter = SlidingWindowLimiter(max_requests=3, window_seconds=10.0)
    user_id = "test-user-1"

    loop = asyncio.new_event_loop()
    try:
        # First 3 requests succeed
        loop.run_until_complete(limiter.check(user_id))
        loop.run_until_complete(limiter.check(user_id))
        loop.run_until_complete(limiter.check(user_id))

        # 4th request must raise 429
        try:
            loop.run_until_complete(limiter.check(user_id))
            assert False, "4th request should raise HTTP 429"
        except HTTPException as exc:
            assert exc.status_code == 429
            assert exc.detail["code"] == "RATE_LIMIT_EXCEEDED"
            assert "Retry-After" in exc.headers
    finally:
        loop.close()
