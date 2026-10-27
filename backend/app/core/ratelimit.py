"""Simple in-process sliding-window rate limiter for AI endpoints."""
from __future__ import annotations
import asyncio
import time
from collections import defaultdict, deque
from typing import Callable
from fastapi import HTTPException, Request

class SlidingWindowLimiter:
    """Thread-safe asyncio sliding window rate limiter."""

    def __init__(self, max_requests: int, window_seconds: float) -> None:
        self._max = max_requests
        self._window = window_seconds
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = asyncio.Lock()

    async def check(self, key: str) -> None:
        async with self._lock:
            now = time.monotonic()
            dq = self._hits[key]
            # evict old hits
            while dq and now - dq[0] > self._window:
                dq.popleft()
            if len(dq) >= self._max:
                raise HTTPException(
                    status_code=429,
                    detail={
                        "code": "RATE_LIMIT_EXCEEDED",
                        "message": f"Too many AI requests. Limit: {self._max} per {int(self._window)}s.",
                        "retry_after_seconds": int(self._window - (now - dq[0])) + 1,
                    },
                    headers={"Retry-After": str(int(self._window - (now - dq[0])) + 1)},
                )
            dq.append(now)

# Module-level limiter: 10 AI requests per minute per user
ai_limiter = SlidingWindowLimiter(max_requests=10, window_seconds=60)
