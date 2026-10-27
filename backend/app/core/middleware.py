"""Small security-focused ASGI middleware used by the API."""
from __future__ import annotations

from uuid import uuid4

from starlette.types import ASGIApp, Message, Receive, Scope, Send

from app.core.logging import request_id_var


class SecurityHeadersMiddleware:
    """Attach defensive response headers and propagate a safe request identifier."""

    def __init__(self, app: ASGIApp, request_id_header: str = "X-Request-ID") -> None:
        self.app = app
        self.request_id_header = request_id_header.lower().encode("latin-1")

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        incoming = dict(scope.get("headers", []))
        candidate = incoming.get(self.request_id_header, b"").decode("latin-1", errors="ignore")
        # Only accept short printable identifiers; otherwise generate one ourselves.
        request_id = candidate if 1 <= len(candidate) <= 80 and candidate.isascii() and candidate.isprintable() else str(uuid4())

        token = request_id_var.set(request_id)
        try:
            async def send_with_headers(message: Message) -> None:
                if message["type"] == "http.response.start":
                    headers = list(message.get("headers", []))
                    existing = {key.lower() for key, _ in headers}
                    defaults = [
                        (b"x-content-type-options", b"nosniff"),
                        (b"x-frame-options", b"DENY"),
                        (b"referrer-policy", b"strict-origin-when-cross-origin"),
                        (b"permissions-policy", b"camera=(), microphone=(), geolocation=()"),
                        (b"cache-control", b"no-store"),
                    ]
                    for key, value in defaults:
                        if key not in existing:
                            headers.append((key, value))
                    headers.append((self.request_id_header, request_id.encode("latin-1")))
                    message["headers"] = headers
                await send(message)

            await self.app(scope, receive, send_with_headers)
        finally:
            request_id_var.reset(token)

