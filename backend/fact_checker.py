import asyncio
import json
import os
import httpx

TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse"


async def check_claim(claim: str) -> dict:
    """Call TinyFish agent to fact-check one claim. Returns dict with verdict/explanation/source."""
    api_key = os.environ["TINYFISH_API_KEY"]
    goal = (
        f'Fact-check this claim: "{claim}". '
        "Search the web to verify. "
        'Return a JSON object with: "verdict" (exactly TRUE, FALSE, or UNVERIFIABLE), '
        '"explanation" (1-2 sentences), "source" (the URL you used to verify).'
    )
    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

    for attempt in range(2):
        try:
            async with httpx.AsyncClient(timeout=60.0) as client:
                async with client.stream("POST", TINYFISH_URL, headers=headers, json={"goal": goal}) as response:
                    async for line in response.aiter_lines():
                        line = line.strip()
                        if not line:
                            continue
                        if line.startswith("data:"):
                            line = line[5:].strip()
                        try:
                            event = json.loads(line)
                        except json.JSONDecodeError:
                            continue
                        if event.get("type") == "COMPLETE":
                            raw = event.get("result", {})
                            if isinstance(raw, str):
                                raw = json.loads(raw)
                            verdict = str(raw.get("verdict", "UNVERIFIABLE")).upper()
                            if verdict not in ("TRUE", "FALSE", "UNVERIFIABLE"):
                                verdict = "UNVERIFIABLE"
                            return {
                                "verdict": verdict,
                                "explanation": raw.get("explanation", ""),
                                "source": raw.get("source", ""),
                            }
        except (httpx.TimeoutException, httpx.HTTPError):
            if attempt == 0:
                await asyncio.sleep(2)

    return {"verdict": "UNVERIFIABLE", "explanation": "Could not verify this claim.", "source": ""}


async def check_claims(claims: list[str]):
    """Async generator: yields claim-checking and result SSE dicts sequentially."""
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
