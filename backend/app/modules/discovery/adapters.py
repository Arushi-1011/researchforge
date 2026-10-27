
"""External publication source adapters.

Responses are normalized, never fabricated.
Rate limits are handled conservatively to avoid repeatedly hitting providers.
"""

import asyncio
import re
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Any

import httpx

from app.modules.discovery.schemas import PaperResult


ARXIV_NS = {"a": "http://www.w3.org/2005/Atom"}

REQUEST_TIMEOUT = 15.0
MAX_ATTEMPTS = 3
BACKOFF_BASE_SECONDS = 1.0
MAX_RETRY_AFTER_SECONDS = 30.0


class SourceError(RuntimeError):
    """Raised when an external publication source cannot be queried."""


def _retry_after_seconds(value: str | None) -> float | None:
    """Parse Retry-After as seconds or an HTTP date."""
    if not value:
        return None

    try:
        return max(0.0, float(value))
    except ValueError:
        pass

    try:
        retry_at = parsedate_to_datetime(value)
        if retry_at.tzinfo is None:
            retry_at = retry_at.replace(tzinfo=timezone.utc)

        now = datetime.now(timezone.utc)
        return max(0.0, (retry_at - now).total_seconds())
    except (TypeError, ValueError, OverflowError):
        return None


async def _get(
    client: httpx.AsyncClient,
    url: str,
    params: dict[str, Any] | None = None,
) -> httpx.Response:
    """Perform a GET with bounded retries for transient failures.

    A 429 response is not retried automatically. The caller receives a clear
    message and can try again after the provider's rate limit has reset.
    """
    last_error: Exception | None = None

    for attempt in range(MAX_ATTEMPTS):
        try:
            response = await client.get(url, params=params)

            if response.status_code == 429:
                retry_after = _retry_after_seconds(
                    response.headers.get("Retry-After")
                )

                if retry_after is not None:
                    if retry_after > MAX_RETRY_AFTER_SECONDS:
                        wait_message = (
                            f"The provider requested a wait of "
                            f"{int(retry_after)} seconds."
                        )
                    else:
                        wait_message = (
                            f"Retry after approximately "
                            f"{max(1, int(retry_after))} seconds."
                        )
                else:
                    wait_message = (
                        "The provider did not specify when requests can resume."
                    )

                raise SourceError(
                    f"HTTP 429: {url.split('/')[2]} is rate-limiting "
                    f"ResearchForge. {wait_message} "
                    "No automatic retry was made."
                )

            if 400 <= response.status_code < 500:
                raise SourceError(
                    f"{url.split('/')[2]} returned HTTP "
                    f"{response.status_code}. Check the request or provider access."
                )

            response.raise_for_status()
            return response

        except SourceError:
            # In particular, never retry a 429 response.
            raise

        except httpx.HTTPStatusError as exc:
            last_error = exc

            # Retry only transient server errors.
            if exc.response.status_code < 500:
                raise SourceError(
                    f"{url.split('/')[2]} returned HTTP "
                    f"{exc.response.status_code}."
                ) from exc

            if attempt < MAX_ATTEMPTS - 1:
                await asyncio.sleep(BACKOFF_BASE_SECONDS * (2 ** attempt))

        except httpx.RequestError as exc:
            last_error = exc

            if attempt < MAX_ATTEMPTS - 1:
                await asyncio.sleep(BACKOFF_BASE_SECONDS * (2 ** attempt))

    raise SourceError(
        f"Could not reach {url.split('/')[2]} after "
        f"{MAX_ATTEMPTS} attempts: {last_error}"
    ) from last_error


class ArxivAdapter:
    name = "arxiv"

    async def search(self, query: str, limit: int) -> list[PaperResult]:
        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            headers={
                "User-Agent": "ResearchForge/0.1 (academic research discovery)"
            },
        ) as client:
            response = await _get(
                client,
                "https://export.arxiv.org/api/query",
                {
                    "search_query": f"all:{query}",
                    "start": 0,
                    "max_results": limit,
                },
            )

        try:
            root = ET.fromstring(response.text)
        except ET.ParseError as exc:
            raise SourceError("arXiv returned malformed Atom XML.") from exc

        results: list[PaperResult] = []

        for entry in root.findall("a:entry", ARXIV_NS):
            ident = (
                entry.findtext("a:id", default="", namespaces=ARXIV_NS)
            ).strip()

            title = re.sub(
                r"\s+",
                " ",
                entry.findtext("a:title", default="", namespaces=ARXIV_NS),
            ).strip()

            abstract = re.sub(
                r"\s+",
                " ",
                entry.findtext("a:summary", default="", namespaces=ARXIV_NS),
            ).strip()

            authors = [
                author.findtext("a:name", default="", namespaces=ARXIV_NS)
                for author in entry.findall("a:author", ARXIV_NS)
            ]

            published = entry.findtext(
                "a:published", default="", namespaces=ARXIV_NS
            )
            year = int(published[:4]) if published[:4].isdigit() else None

            pdf_url = next(
                (
                    link.attrib.get("href")
                    for link in entry.findall("a:link", ARXIV_NS)
                    if link.attrib.get("title") == "pdf"
                ),
                None,
            )

            source_id = ident.rsplit("/", 1)[-1] if ident else ""

            results.append(
                PaperResult(
                    source=self.name,
                    source_id=source_id,
                    title=title,
                    authors=authors,
                    year=year,
                    abstract=abstract,
                    pdf_url=pdf_url,
                    landing_url=ident or None,
                )
            )

        return results


class SemanticScholarAdapter:
    name = "semantic_scholar"

    async def search(self, query: str, limit: int) -> list[PaperResult]:
        fields = (
            "title,authors,year,venue,citationCount,abstract,"
            "externalIds,openAccessPdf,url"
        )

        async with httpx.AsyncClient(
            timeout=REQUEST_TIMEOUT,
            headers={
                "User-Agent": "ResearchForge/0.1 (academic research discovery)"
            },
        ) as client:
            response = await _get(
                client,
                "https://api.semanticscholar.org/graph/v1/paper/search",
                {
                    "query": query,
                    "limit": limit,
                    "fields": fields,
                },
            )

        try:
            items = response.json().get("data", [])
        except (ValueError, AttributeError) as exc:
            raise SourceError(
                "Semantic Scholar returned invalid JSON."
            ) from exc

        results: list[PaperResult] = []

        for item in items:
            external = item.get("externalIds") or {}
            pdf = item.get("openAccessPdf") or {}

            results.append(
                PaperResult(
                    source=self.name,
                    source_id=str(item.get("paperId") or ""),
                    title=item.get("title") or "",
                    authors=[
                        author.get("name", "")
                        for author in (item.get("authors") or [])
                    ],
                    year=item.get("year"),
                    venue=item.get("venue"),
                    citation_count=item.get("citationCount"),
                    abstract=item.get("abstract") or "",
                    doi=external.get("DOI"),
                    pdf_url=pdf.get("url"),
                    landing_url=item.get("url"),
                )
            )

        return results
