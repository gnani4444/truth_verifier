import asyncio
import os
import pytest
from unittest.mock import patch, AsyncMock
from fact_checker import check_claim, check_claims

ENV = {"TINYFISH_API_KEY": "test-key"}

# Authority-domain snippets get 2x weight; 3+ support/deny score triggers early return.
_TRUE_RESULTS = [
    {
        "title": "X is beneficial and helps",
        "snippet": "research shows X is beneficial and improves health, studies show it helps",
        "url": "https://nih.gov/x",
    }
]

_FALSE_RESULTS = [
    {
        "title": "X is a myth",
        "snippet": "no evidence, myth, debunked, no scientific evidence found",
        "url": "https://nih.gov/y",
    }
]


def test_check_claim_returns_true_verdict():
    # _search returns authority-domain results with strong support phrases (score >= 3)
    with patch("fact_checker._search", new=AsyncMock(return_value=_TRUE_RESULTS)), \
         patch.dict("os.environ", ENV):
        result = asyncio.run(check_claim("X is good for you"))
    assert result["verdict"] == "TRUE"
    assert result["source"] == "https://nih.gov/x"


def test_check_claim_returns_false_verdict():
    # _search returns authority-domain results with strong deny phrases (score >= 3)
    with patch("fact_checker._search", new=AsyncMock(return_value=_FALSE_RESULTS)), \
         patch.dict("os.environ", ENV):
        result = asyncio.run(check_claim("Lemon cures cancer"))
    assert result["verdict"] == "FALSE"


def test_check_claim_returns_unverifiable_on_timeout():
    # _search returns empty (e.g. after a timeout inside _search) → UNVERIFIABLE
    with patch("fact_checker._search", new=AsyncMock(return_value=[])), \
         patch.dict("os.environ", ENV):
        result = asyncio.run(check_claim("Some claim"))
    assert result["verdict"] == "UNVERIFIABLE"


def test_check_claims_yields_claim_event_then_result_event():
    async def run():
        with patch("fact_checker.check_claim", new=AsyncMock(return_value={
            "verdict": "FALSE", "explanation": "No evidence.", "source": ""
        })):
            events = []
            async for event in check_claims(["Lemon cures cancer"]):
                events.append(event)
            return events

    events = asyncio.run(run())
    assert len(events) == 2
    assert events[0] == {"type": "claim", "text": "Lemon cures cancer", "status": "checking"}
    assert events[1]["type"] == "result"
    assert events[1]["verdict"] == "FALSE"
    assert events[1]["text"] == "Lemon cures cancer"
