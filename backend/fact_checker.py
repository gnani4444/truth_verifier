import asyncio
import json
import os
import re
import httpx

SEARCH_URL = "https://api.search.tinyfish.ai"
FETCH_URL = "https://api.fetch.tinyfish.ai"


async def _search(query: str, api_key: str) -> list[dict]:
    """TinyFish Search API — returns list of {title, snippet, url}."""
    async with httpx.AsyncClient(timeout=30.0) as client:
        try:
            resp = await client.get(
                SEARCH_URL,
                params={"query": query, "language": "en"},
                headers={"X-API-Key": api_key},
            )
            if resp.status_code == 200:
                return resp.json().get("results", [])
        except (httpx.TimeoutException, httpx.HTTPError):
            pass
    return []


async def _fetch_pages(urls: list[str], api_key: str) -> list[dict]:
    """TinyFish Fetch API — returns list of {url, content} for each fetched page."""
    if not urls:
        return []
    async with httpx.AsyncClient(timeout=60.0) as client:
        try:
            resp = await client.post(
                FETCH_URL,
                json={"urls": urls, "format": "markdown"},
                headers={"X-API-Key": api_key, "Content-Type": "application/json"},
            )
            if resp.status_code == 200:
                return resp.json().get("results", [])
        except (httpx.TimeoutException, httpx.HTTPError):
            pass
    return []


# Phrases that indicate a source supports a claim
_SUPPORT = [
    "has been shown", "research shows", "studies show", "evidence shows",
    "study found", "research found", "studies found", "found to", "shown to",
    "can help", "may help", "helps", "improves", "reduces", "relieves",
    "beneficial", "benefits", "effective", "supports", "promotes",
    "associated with", "linked to", "known to", "traditionally used",
    "clinical", "scientifically", "evidence suggests", "research suggests",
]

# Phrases that indicate a source contradicts a claim
_DENY = [
    "no evidence", "not proven", "no proof", "no scientific evidence",
    "myth", "debunked", "false", "misleading", "not effective",
    "little evidence", "limited evidence", "lacks evidence",
    "not supported by", "contradicts", "no studies",
]

# Authoritative health/science domains get double weight
_AUTHORITY_DOMAINS = [
    "healthline.com", "webmd.com", "mayoclinic.org", "nih.gov", "ncbi.nlm.nih.gov",
    "medicalnewstoday.com", "harvard.edu", "who.int", "cdc.gov", "pubmed",
    "health.com", "verywellhealth.com", "medicineplus", "clevelandclinic.org",
]


def _score_text(text: str, url: str) -> tuple[int, int]:
    """Return (support_score, deny_score) for a block of text."""
    t = text.lower()
    weight = 2 if any(d in url for d in _AUTHORITY_DOMAINS) else 1
    support = weight * sum(1 for p in _SUPPORT if p in t)
    deny = weight * sum(1 for p in _DENY if p in t)
    return support, deny


def _verdict_from_scores(support: int, deny: int, top_text: str, top_url: str) -> dict:
    explanation = (top_text[:300].strip() + "...") if len(top_text) > 300 else top_text.strip()
    if support > 0 and support >= deny:
        return {"verdict": "TRUE", "explanation": explanation, "source": top_url}
    if deny > support and deny > 0:
        return {"verdict": "FALSE", "explanation": explanation, "source": top_url}
    if top_text.strip():
        return {"verdict": "UNVERIFIABLE", "explanation": explanation, "source": top_url}
    return {"verdict": "UNVERIFIABLE", "explanation": "Could not verify this claim.", "source": top_url}


async def check_claim(claim: str) -> dict:
    """
    Fact-check a claim using TinyFish Search + Fetch APIs:
    1. Search for the claim to get relevant URLs
    2. Fetch the top pages to get full content
    3. Score the content for support/contradiction phrases
    """
    api_key = os.environ["TINYFISH_API_KEY"]

    # Step 1: Search
    results = await _search(claim, api_key)
    if not results:
        return {"verdict": "UNVERIFIABLE", "explanation": "No sources found for this claim.", "source": ""}

    top_url = results[0].get("url", "")
    top_snippet = results[0].get("snippet", "")

    # Step 2: Score snippets first (fast, no extra API call)
    total_support = 0
    total_deny = 0
    for r in results[:5]:
        s, d = _score_text(r.get("snippet", "") + " " + r.get("title", ""), r.get("url", ""))
        total_support += s
        total_deny += d

    # If snippets alone are decisive, return now
    if total_support >= 3 or total_deny >= 3:
        return _verdict_from_scores(total_support, total_deny, top_snippet, top_url)

    # Step 3: Fetch full page content for richer analysis
    urls_to_fetch = [r["url"] for r in results[:3] if r.get("url")]
    pages = await _fetch_pages(urls_to_fetch, api_key)

    for page in pages:
        content = page.get("content", "") or page.get("markdown", "") or ""
        url = page.get("url", top_url)
        if not content:
            continue
        s, d = _score_text(content, url)
        total_support += s
        total_deny += d
        # Use first page's content as explanation source
        if url == urls_to_fetch[0]:
            top_snippet = content[:300]
            top_url = url

    return _verdict_from_scores(total_support, total_deny, top_snippet, top_url)


async def check_claims(claims: list[str]):
    """Async generator: yields claim and result SSE dicts sequentially."""
    for claim in claims:
        yield {"type": "claim", "text": claim, "status": "checking"}
        result = await check_claim(claim)
        yield {
            "type": "result",
            "text": claim,
            "verdict": result["verdict"],
            "explanation": result["explanation"],
            "source": result["source"],
        }
