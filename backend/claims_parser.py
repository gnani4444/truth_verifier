import json
import os
import httpx

TINYFISH_URL = "https://agent.tinyfish.ai/v1/automation/run-sse"


async def parse_claims(raw_text: str) -> list[str]:
    """Use TinyFish Agent to extract distinct factual claims. Returns list of strings."""
    if not raw_text.strip():
        return []

    api_key = os.environ["TINYFISH_API_KEY"]
    goal = (
        "From the following text, extract all distinct verifiable factual claims.\n"
        "Return ONLY a JSON array of strings. Each string is one specific claim.\n"
        "Include: statistics, health claims, historical facts, current events, named facts.\n"
        "Exclude: opinions, vague statements, non-verifiable assertions.\n\n"
        f"Text:\n{raw_text}\n\n"
        'Return format: ["claim 1", "claim 2", ...]'
    )

    headers = {"X-API-Key": api_key, "Content-Type": "application/json"}

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
                    raw = event.get("result", [])
                    if isinstance(raw, str):
                        # Try direct JSON parse first
                        try:
                            raw = json.loads(raw)
                        except json.JSONDecodeError:
                            # Fallback: extract JSON array from anywhere in the string
                            import re
                            match = re.search(r'\[.*?\]', raw, re.DOTALL)
                            if match:
                                try:
                                    raw = json.loads(match.group())
                                except json.JSONDecodeError:
                                    raw = []
                            else:
                                raw = []
                    if isinstance(raw, list):
                        return [c for c in raw if isinstance(c, str)]

    return []
