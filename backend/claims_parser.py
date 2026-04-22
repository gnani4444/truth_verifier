import json
import os
import re
import httpx

TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse"


def _sentences_from_text(text: str) -> list[str]:
    """Fallback: split text into non-trivial sentences to use as claims directly."""
    sentences = re.split(r'(?<=[.!?])\s+', text.strip())
    return [s.strip() for s in sentences if len(s.strip()) > 20]


def _parse_tinyfish_result(raw) -> list[str]:
    """Try every reasonable format TinyFish might return a JSON array in."""
    if isinstance(raw, list):
        return [c for c in raw if isinstance(c, str)]

    if not isinstance(raw, str):
        return []

    # Strip markdown code fences
    raw = re.sub(r'```(?:json)?\s*', '', raw).strip()

    # Try direct parse
    try:
        parsed = json.loads(raw)
        if isinstance(parsed, list):
            return [c for c in parsed if isinstance(c, str)]
    except json.JSONDecodeError:
        pass

    # Find the outermost [...] (greedy — handles multi-line arrays)
    match = re.search(r'\[[\s\S]*\]', raw)
    if match:
        try:
            parsed = json.loads(match.group())
            if isinstance(parsed, list):
                return [c for c in parsed if isinstance(c, str)]
        except json.JSONDecodeError:
            pass

    return []


async def parse_claims(raw_text: str) -> list[str]:
    """Use TinyFish Agent to extract distinct factual claims. Returns list of strings."""
    if not raw_text.strip():
        return []

    api_key = os.environ["TINYFISH_API_KEY"]

    # Restate the content as plain declarative sentences before asking for claims
    goal = (
        "Read the following transcript and restate every factual assertion it makes as "
        "short, self-contained declarative sentences suitable for independent fact-checking.\n"
        "Include: numbers, statistics, health claims, named people/places/events, historical facts.\n"
        "Exclude: pure opinions, questions, greetings, filler phrases.\n\n"
        f"Transcript:\n{raw_text}\n\n"
        "Output ONLY a JSON array of strings, one claim per element. "
        'Example: ["Claim one.", "Claim two."]'
    )

    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=90.0) as client:
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
                        claims = _parse_tinyfish_result(event.get("result", []))
                        if claims:
                            return claims
    except (httpx.TimeoutException, httpx.HTTPError):
        pass

    # Last resort: treat each sentence in the transcript as a claim
    return _sentences_from_text(raw_text)
