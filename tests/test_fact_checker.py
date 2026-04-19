import asyncio
import json
import os
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fact_checker import check_claim, check_claims

ENV = {"TINYFISH_API_KEY": "test-key"}


def make_sse_lines(result_dict: dict) -> list[str]:
    started = json.dumps({"type": "STARTED", "run_id": "123"})
    complete = json.dumps({"type": "COMPLETE", "run_id": "123", "result": result_dict})
    return [f"data: {started}", f"data: {complete}"]


def build_mock_httpx(lines: list[str]):
    async def aiter_lines():
        for line in lines:
            yield line

    mock_response = MagicMock()
    mock_response.aiter_lines = aiter_lines

    mock_stream_cm = AsyncMock()
    mock_stream_cm.__aenter__ = AsyncMock(return_value=mock_response)
    mock_stream_cm.__aexit__ = AsyncMock(return_value=False)

    mock_client = MagicMock()
    mock_client.stream = MagicMock(return_value=mock_stream_cm)

    mock_client_cm = AsyncMock()
    mock_client_cm.__aenter__ = AsyncMock(return_value=mock_client)
    mock_client_cm.__aexit__ = AsyncMock(return_value=False)

    return mock_client_cm


def test_check_claim_returns_true_verdict():
    lines = make_sse_lines({"verdict": "TRUE", "explanation": "Verified.", "source": "https://cnn.com"})
    with patch("fact_checker.httpx.AsyncClient", return_value=build_mock_httpx(lines)), \
         patch.dict("os.environ", ENV):
        result = asyncio.run(check_claim("Biden is president"))
    assert result["verdict"] == "TRUE"
    assert result["source"] == "https://cnn.com"


def test_check_claim_returns_false_verdict():
    lines = make_sse_lines({"verdict": "FALSE", "explanation": "No evidence.", "source": ""})
    with patch("fact_checker.httpx.AsyncClient", return_value=build_mock_httpx(lines)), \
         patch.dict("os.environ", ENV):
        result = asyncio.run(check_claim("Lemon cures cancer"))
    assert result["verdict"] == "FALSE"


def test_check_claim_returns_unverifiable_on_timeout():
    import httpx
    with patch("fact_checker.httpx.AsyncClient") as mock_cls, \
         patch("fact_checker.asyncio.sleep", new=AsyncMock()), \
         patch.dict("os.environ", ENV):
        mock_cls.return_value.__aenter__ = AsyncMock(side_effect=httpx.TimeoutException("timeout"))
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
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
