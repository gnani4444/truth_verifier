import asyncio
import json
import os
from unittest.mock import patch, AsyncMock, MagicMock
from claims_parser import parse_claims

ENV = {"TINYFISH_API_KEY": "test-key"}


def build_mock_httpx_with_result(result):
    complete = json.dumps({"type": "COMPLETE", "run_id": "123", "result": result})

    async def aiter_lines():
        yield f"data: {complete}"

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


def test_parse_claims_returns_list_of_strings():
    result = '["Biden is president", "Lemon cures cancer"]'
    with patch("claims_parser.httpx.AsyncClient", return_value=build_mock_httpx_with_result(result)), \
         patch.dict("os.environ", ENV):
        claims = asyncio.run(parse_claims("Some health content"))
    assert isinstance(claims, list)
    assert "Biden is president" in claims
    assert "Lemon cures cancer" in claims


def test_parse_claims_returns_empty_for_blank_text():
    claims = asyncio.run(parse_claims(""))
    assert claims == []


def test_parse_claims_handles_json_array_result():
    result = ["The earth is flat", "Vaccines cause autism"]
    with patch("claims_parser.httpx.AsyncClient", return_value=build_mock_httpx_with_result(result)), \
         patch.dict("os.environ", ENV):
        claims = asyncio.run(parse_claims("flat earth content"))
    assert "The earth is flat" in claims


def test_parse_claims_ignores_non_string_items():
    result = '[42, "Real claim", null]'
    with patch("claims_parser.httpx.AsyncClient", return_value=build_mock_httpx_with_result(result)), \
         patch.dict("os.environ", ENV):
        claims = asyncio.run(parse_claims("mixed content"))
    assert claims == ["Real claim"]
