"""Search endpoint with short-lived in-process response cache and source warnings."""
import asyncio
import hashlib
import json
import time
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.deps import get_current_user
from app.core.db import get_db
from app.modules.users.models import User
from app.modules.discovery.schemas import SearchRequest, SearchResponse
from app.modules.discovery.adapters import ArxivAdapter, SemanticScholarAdapter, SourceError

router = APIRouter(prefix="/discovery", tags=["discovery"])
_cache: dict[str, tuple[float, str]] = {}
_CACHE_TTL = 300
_lock = asyncio.Lock()

@router.post("/search", response_model=SearchResponse)
async def search_publications(payload: SearchRequest, user: User = Depends(get_current_user),
                              db: AsyncSession = Depends(get_db)) -> SearchResponse:
    del user, db
    query = payload.query.strip()
    key = hashlib.sha256(json.dumps([query.casefold(), sorted(payload.sources), payload.limit]).encode()).hexdigest()
    async with _lock:
        cached = _cache.get(key)
        if cached and cached[0] > time.monotonic():
            return SearchResponse.model_validate_json(cached[1])
    adapters = {"arxiv": ArxivAdapter(), "semantic_scholar": SemanticScholarAdapter()}
    tasks = [adapters[source].search(query, payload.limit) for source in payload.sources]
    gathered = await asyncio.gather(*tasks, return_exceptions=True)
    results, warnings = [], []
    for source, outcome in zip(payload.sources, gathered):
        if isinstance(outcome, Exception):
            warnings.append(f"{source} search unavailable: {outcome}")
        else:
            results.extend(outcome)
    # Stable deduplication by DOI where known, otherwise source + identifier.
    seen: set[str] = set()
    unique = []
    for paper in results:
        identity = f"doi:{paper.doi.casefold()}" if paper.doi else f"{paper.source}:{paper.source_id}"
        if identity not in seen:
            seen.add(identity)
            unique.append(paper)
    response = SearchResponse(query=query, results=unique, warnings=warnings)
    async with _lock:
        _cache[key] = (time.monotonic() + _CACHE_TTL, response.model_dump_json())
    if not unique and warnings:
        # A partial source failure is represented in the response, not as a false empty success.
        return response
    return response
