# Truth Verifier Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a web app that downloads a public Instagram post/reel, extracts spoken and visual content, and streams fact-check results via TinyFish agent.

**Architecture:** Next.js frontend (Render) → FastAPI backend (Render, Docker) → yt-dlp download → Gradium STT audio extraction → optional Gemini Vision (default OFF, user-toggled) → TinyFish claim extraction → TinyFish sequential fact-checking → SSE stream back to UI.

**Tech Stack:** Python 3.11, FastAPI, sse-starlette, yt-dlp, ffmpeg, Gradium SDK, httpx, google-generativeai (optional, vision only), Next.js 14, TypeScript, Tailwind CSS

---

## File Map

```
truth_verifier/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   ├── main.py              # FastAPI app, routes, SSE endpoint, job store
│   ├── models.py            # Pydantic models: VerifyRequest, VerifyResponse
│   ├── downloader.py        # yt-dlp wrapper → (file_path, media_type)
│   ├── extractor.py         # Gradium STT + optional Gemini Vision → raw text string
│   ├── claims_parser.py     # TinyFish Agent → list[str] of factual claims
│   └── fact_checker.py      # TinyFish agent loop → async generator of SSE dicts
├── frontend/
│   ├── app/
│   │   ├── layout.tsx
│   │   └── page.tsx         # Main page: wires all components together
│   ├── components/
│   │   ├── UrlInput.tsx     # URL input + Verify button
│   │   ├── MediaPreview.tsx # Video/image preview + Download button
│   │   ├── ClaimCard.tsx    # Single claim with verdict badge
│   │   └── ClaimsList.tsx   # SSE-driven list of ClaimCards
│   ├── lib/
│   │   └── api.ts           # postVerify(), getMediaUrl(), streamResults()
│   ├── types/
│   │   └── index.ts         # TypeScript types for SSE events and claim state
│   ├── .env.local.example
│   └── next.config.ts
├── tests/
│   ├── conftest.py
│   ├── test_downloader.py
│   ├── test_claims_parser.py
│   └── test_fact_checker.py
└── render.yaml
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `backend/requirements.txt`
- Create: `backend/.env.example`
- Create: `backend/Dockerfile`
- Create: `frontend/` (via create-next-app)
- Create: `frontend/.env.local.example`
- Create: `tests/conftest.py`

- [ ] **Step 1: Create backend directory and requirements.txt**

```
truth_verifier/backend/requirements.txt
```

```
fastapi==0.115.0
uvicorn[standard]==0.30.6
sse-starlette==2.1.3
python-multipart==0.0.9
yt-dlp==2025.1.15
gradium
httpx==0.27.2
python-dotenv==1.0.1
pydantic==2.9.2
pytest==8.3.3
pytest-asyncio==0.24.0
# optional — only needed when GEMINI_API_KEY is set and use_vision=true
google-generativeai==0.8.3
```

- [ ] **Step 2: Create backend/.env.example**

```
GRADIUM_API_KEY=your_gradium_api_key
TINYFISH_API_KEY=your_tinyfish_api_key
# Optional — only needed when user enables Visual Analysis in the UI
GEMINI_API_KEY=your_gemini_api_key
```

- [ ] **Step 3: Create backend/Dockerfile**

```dockerfile
FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

CMD uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}
```

- [ ] **Step 4: Scaffold Next.js frontend**

```bash
cd "/Users/gnaneshwarvanam/Downloads/Coding Projects/truth_verifier"
npx create-next-app@latest frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*"
```

Expected: `frontend/` directory created with Next.js app structure.

- [ ] **Step 5: Create frontend/.env.local.example**

```
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

- [ ] **Step 6: Create tests/conftest.py**

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))
```

- [ ] **Step 7: Commit scaffold**

```bash
git init
git add .
git commit -m "feat: project scaffold — backend + frontend structure"
```

---

## Task 2: Backend Models

**Files:**
- Create: `backend/models.py`

- [ ] **Step 1: Create backend/models.py**

```python
from pydantic import BaseModel


class VerifyRequest(BaseModel):
    url: str
    use_vision: bool = False


class VerifyResponse(BaseModel):
    job_id: str
```

- [ ] **Step 2: Commit**

```bash
git add backend/models.py
git commit -m "feat: backend pydantic models"
```

---

## Task 3: Downloader Module (TDD)

**Files:**
- Create: `backend/downloader.py`
- Create: `tests/test_downloader.py`

- [ ] **Step 1: Write failing tests**

`tests/test_downloader.py`:

```python
import pytest
from unittest.mock import patch, MagicMock
from downloader import download_instagram


def make_mock_ydl(info: dict, side_effect=None):
    mock_instance = MagicMock()
    mock_instance.__enter__ = lambda s: mock_instance
    mock_instance.__exit__ = MagicMock(return_value=False)
    if side_effect:
        mock_instance.extract_info.side_effect = side_effect
    else:
        mock_instance.extract_info.return_value = info
    return mock_instance


def test_download_video_returns_mp4_and_video_type():
    info = {"ext": "mp4", "vcodec": "h264", "acodec": "aac"}
    with patch("downloader.yt_dlp.YoutubeDL", return_value=make_mock_ydl(info)):
        path, media_type = download_instagram("https://instagram.com/reel/abc")
    assert path.endswith(".mp4")
    assert media_type == "video"


def test_download_image_returns_jpg_and_image_type():
    info = {"ext": "jpg", "vcodec": "none", "acodec": "none"}
    with patch("downloader.yt_dlp.YoutubeDL", return_value=make_mock_ydl(info)):
        path, media_type = download_instagram("https://instagram.com/p/abc")
    assert path.endswith(".jpg")
    assert media_type == "image"


def test_download_raises_on_ydl_error():
    with patch(
        "downloader.yt_dlp.YoutubeDL",
        return_value=make_mock_ydl({}, side_effect=Exception("login required")),
    ):
        with pytest.raises(Exception, match="login required"):
            download_instagram("https://instagram.com/reel/private")
```

- [ ] **Step 2: Run tests — expect failure**

```bash
cd "/Users/gnaneshwarvanam/Downloads/Coding Projects/truth_verifier"
python -m pytest tests/test_downloader.py -v
```

Expected: `ModuleNotFoundError: No module named 'downloader'`

- [ ] **Step 3: Implement backend/downloader.py**

```python
import os
import uuid
import yt_dlp

DOWNLOAD_DIR = "/tmp/truth_verifier"


def download_instagram(url: str) -> tuple[str, str]:
    """Download a public Instagram post. Returns (file_path, media_type)."""
    os.makedirs(DOWNLOAD_DIR, exist_ok=True)
    job_id = str(uuid.uuid4())
    output_template = f"{DOWNLOAD_DIR}/{job_id}.%(ext)s"

    ydl_opts = {
        "outtmpl": output_template,
        "quiet": True,
        "no_warnings": True,
    }

    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
        info = ydl.extract_info(url, download=True)

    ext = info.get("ext", "mp4")
    path = f"{DOWNLOAD_DIR}/{job_id}.{ext}"
    vcodec = info.get("vcodec", "none")
    media_type = "video" if vcodec and vcodec != "none" else "image"

    return path, media_type
```

- [ ] **Step 4: Run tests — expect pass**

```bash
python -m pytest tests/test_downloader.py -v
```

Expected: 3 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/downloader.py tests/test_downloader.py
git commit -m "feat: downloader module with yt-dlp"
```

---

## Task 4: Claims Parser Module (TDD)

**Files:**
- Create: `backend/claims_parser.py`
- Create: `tests/test_claims_parser.py`

Uses TinyFish Agent to extract factual claims from raw text. Goal is sent without a URL so TinyFish processes the text directly and returns a JSON array.

- [ ] **Step 1: Write failing tests**

`tests/test_claims_parser.py`:

```python
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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
python -m pytest tests/test_claims_parser.py -v
```

Expected: `ModuleNotFoundError: No module named 'claims_parser'`

- [ ] **Step 3: Implement backend/claims_parser.py**

```python
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
                    # result may be a JSON string or already a list
                    if isinstance(raw, str):
                        raw = json.loads(raw)
                    if isinstance(raw, list):
                        return [c for c in raw if isinstance(c, str)]

    return []
```

- [ ] **Step 4: Run tests — expect pass**

```bash
python -m pytest tests/test_claims_parser.py -v
```

Expected: 4 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/claims_parser.py tests/test_claims_parser.py
git commit -m "feat: claims parser with TinyFish agent"
```

---

## Task 5: Fact Checker Module (TDD)

**Files:**
- Create: `backend/fact_checker.py`
- Create: `tests/test_fact_checker.py`

- [ ] **Step 1: Write failing tests**

`tests/test_fact_checker.py`:

```python
import asyncio
import json
import os
import pytest
from unittest.mock import patch, AsyncMock, MagicMock
from fact_checker import check_claim, check_claims


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


ENV = {"TINYFISH_API_KEY": "test-key"}


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
```

- [ ] **Step 2: Run tests — expect failure**

```bash
python -m pytest tests/test_fact_checker.py -v
```

Expected: `ModuleNotFoundError: No module named 'fact_checker'`

- [ ] **Step 3: Implement backend/fact_checker.py**

```python
import asyncio
import json
import os
import httpx
from typing import AsyncGenerator

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
```

- [ ] **Step 4: Run tests — expect pass**

```bash
python -m pytest tests/test_fact_checker.py -v
```

Expected: 4 tests PASSED

- [ ] **Step 5: Commit**

```bash
git add backend/fact_checker.py tests/test_fact_checker.py
git commit -m "feat: fact checker with TinyFish agent"
```

---

## Task 6: Extractor Module

**Files:**
- Create: `backend/extractor.py`

Gemini Vision is **optional** — only imported and called when `use_vision=True` is passed. If `use_vision=False` (default), only Gradium STT runs.

(No unit tests — calls ffmpeg subprocesses and Gradium/Gemini. Integration-level only. Tested manually.)

- [ ] **Step 1: Create backend/extractor.py**

```python
import asyncio
import base64
import os
import subprocess
from pathlib import Path

import gradium


async def _transcribe_audio(audio_path: str) -> str:
    """Stream WAV file through Gradium STT. Returns transcript string."""
    client = gradium.client.GradiumClient()

    with open(audio_path, "rb") as f:
        audio_data = f.read()

    async def audio_generator(data, chunk_size=1920):
        for i in range(0, len(data), chunk_size):
            yield data[i: i + chunk_size]

    stream = await client.stt_stream(
        {
            "model_name": "default",
            "input_format": "wav",
            "json_config": {"language": "en", "text_temperature": 0.0},
        },
        audio_generator(audio_data),
    )

    transcript = []
    async for message in stream.iter_text():
        transcript.append(message)

    return " ".join(transcript)


async def _extract_audio_text(video_path: str) -> str:
    """Extract audio from video with ffmpeg, transcribe with Gradium. Returns text."""
    audio_path = str(Path(video_path).with_suffix(".wav"))

    result = subprocess.run(
        [
            "ffmpeg", "-i", video_path,
            "-vn", "-acodec", "pcm_s16le", "-ar", "24000", "-ac", "1",
            audio_path, "-y", "-loglevel", "error",
        ],
        capture_output=True,
    )

    if result.returncode != 0 or not os.path.exists(audio_path):
        return ""

    if os.path.getsize(audio_path) < 1000:
        os.unlink(audio_path)
        return ""

    try:
        text = await _transcribe_audio(audio_path)
    finally:
        if os.path.exists(audio_path):
            os.unlink(audio_path)

    return text


def _extract_keyframes(video_path: str, num_frames: int = 3) -> list[str]:
    """Extract evenly-spaced keyframes from video. Returns list of JPEG file paths."""
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", video_path],
        capture_output=True,
        text=True,
    )
    duration = float(result.stdout.strip() or "10")
    frame_paths = []

    for i in range(num_frames):
        t = duration * (i + 1) / (num_frames + 1)
        out_path = f"{video_path}_frame{i}.jpg"
        subprocess.run(
            ["ffmpeg", "-ss", str(t), "-i", video_path, "-vframes", "1", out_path, "-y", "-loglevel", "error"],
            check=True,
        )
        frame_paths.append(out_path)

    return frame_paths


def _analyze_visuals(image_paths: list[str]) -> str:
    """Use Gemini Vision to describe factual claims in images. Returns text.
    Only called when use_vision=True. Requires GEMINI_API_KEY env var."""
    import google.generativeai as genai
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    model = genai.GenerativeModel("gemini-2.0-flash")

    parts: list = [
        "List all factual claims, statistics, text overlays, and verifiable statements visible in these images. "
        "Be specific. One claim per line."
    ]

    for path in image_paths:
        with open(path, "rb") as f:
            image_bytes = f.read()
        parts.append({"mime_type": "image/jpeg", "data": base64.b64encode(image_bytes).decode()})

    response = model.generate_content(parts)
    return response.text


async def extract_text(file_path: str, media_type: str, use_vision: bool = False) -> str:
    """Extract textual content from media. Gemini Vision only runs if use_vision=True."""
    parts = []

    if media_type == "video":
        audio_text = await _extract_audio_text(file_path)
        if audio_text.strip():
            parts.append(f"Spoken content:\n{audio_text}")

        if use_vision:
            frame_paths = _extract_keyframes(file_path)
            try:
                visual_text = _analyze_visuals(frame_paths)
                if visual_text.strip():
                    parts.append(f"Visual content:\n{visual_text}")
            finally:
                for p in frame_paths:
                    if os.path.exists(p):
                        os.unlink(p)

    elif media_type == "image":
        if use_vision:
            visual_text = _analyze_visuals([file_path])
            if visual_text.strip():
                parts.append(f"Visual content:\n{visual_text}")

    return "\n\n".join(parts)
```

- [ ] **Step 2: Commit**

```bash
git add backend/extractor.py
git commit -m "feat: extractor — Gradium STT + optional Gemini Vision"
```

---

## Task 7: FastAPI Main App

**Files:**
- Create: `backend/main.py`

- [ ] **Step 1: Create backend/main.py**

```python
import asyncio
import json
import os
import uuid

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sse_starlette.sse import EventSourceResponse

from claims_parser import parse_claims
from downloader import download_instagram
from extractor import extract_text
from fact_checker import check_claims
from models import VerifyRequest, VerifyResponse

load_dotenv()

app = FastAPI(title="Truth Verifier API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory job store: job_id → {url, use_vision, media_path, media_type}
jobs: dict[str, dict] = {}


@app.post("/verify", response_model=VerifyResponse)
async def start_verify(req: VerifyRequest):
    job_id = str(uuid.uuid4())
    jobs[job_id] = {"url": req.url, "use_vision": req.use_vision, "media_path": None, "media_type": None}
    return VerifyResponse(job_id=job_id)


@app.get("/media/{job_id}")
async def get_media(job_id: str):
    job = jobs.get(job_id)
    if not job or not job.get("media_path"):
        raise HTTPException(status_code=404, detail="Media not ready")
    return FileResponse(job["media_path"])


@app.get("/verify/stream/{job_id}")
async def stream_verify(job_id: str):
    job = jobs.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    use_vision = job["use_vision"]

    async def event_generator():
        try:
            # Step 1: Download media
            yield {"data": json.dumps({"type": "status", "message": "Downloading post..."})}
            try:
                media_path, media_type = download_instagram(job["url"])
            except Exception as e:
                msg = str(e).lower()
                if "login" in msg or "private" in msg:
                    yield {"data": json.dumps({"type": "error", "message": "This post is private or requires login"})}
                else:
                    yield {"data": json.dumps({"type": "error", "message": "Could not fetch post — check the URL"})}
                return

            jobs[job_id]["media_path"] = media_path
            jobs[job_id]["media_type"] = media_type
            yield {"data": json.dumps({"type": "media", "media_type": media_type, "filename": os.path.basename(media_path)})}

            # Step 2: Extract content (Gradium STT always; Gemini Vision only if use_vision)
            status_msg = "Extracting audio + visuals..." if use_vision else "Extracting audio..."
            yield {"data": json.dumps({"type": "status", "message": status_msg})}
            raw_text = await extract_text(media_path, media_type, use_vision=use_vision)

            if not raw_text.strip():
                hint = "" if use_vision else " Try enabling Visual Analysis for image-only posts."
                yield {"data": json.dumps({"type": "error", "message": f"No content could be extracted.{hint}"})}
                return

            # Step 3: Find claims via TinyFish
            yield {"data": json.dumps({"type": "status", "message": "Finding claims..."})}
            claims = await parse_claims(raw_text)

            if not claims:
                yield {"data": json.dumps({"type": "error", "message": "No verifiable claims found in this content"})}
                return

            # Step 4: Fact-check each claim sequentially via TinyFish
            async for event in check_claims(claims):
                yield {"data": json.dumps(event)}
                await asyncio.sleep(0)

            yield {"data": json.dumps({"type": "done"})}

        except Exception as e:
            yield {"data": json.dumps({"type": "error", "message": str(e)})}

    return EventSourceResponse(event_generator())
```

- [ ] **Step 2: Start backend locally and test with curl**

```bash
cd "/Users/gnaneshwarvanam/Downloads/Coding Projects/truth_verifier/backend"
cp .env.example .env
# Fill in your API keys in .env, then:
uvicorn main:app --reload --port 8000
```

In another terminal:
```bash
curl -s -X POST http://localhost:8000/verify \
  -H "Content-Type: application/json" \
  -d '{"url": "https://www.instagram.com/reel/TEST"}' | python3 -m json.tool
```

Expected: `{"job_id": "<uuid>"}`

- [ ] **Step 3: Commit**

```bash
git add backend/main.py
git commit -m "feat: FastAPI main app with SSE streaming endpoint"
```

---

## Task 8: Frontend Types + API Client

**Files:**
- Create: `frontend/types/index.ts`
- Create: `frontend/lib/api.ts`

- [ ] **Step 1: Create frontend/types/index.ts**

```typescript
export interface MediaEvent {
  type: 'media';
  media_type: 'video' | 'image';
  filename: string;
}

export interface ClaimEvent {
  type: 'claim';
  text: string;
  status: 'checking';
}

export interface ResultEvent {
  type: 'result';
  text: string;
  verdict: 'TRUE' | 'FALSE' | 'UNVERIFIABLE';
  explanation: string;
  source: string;
}

export interface StatusEvent {
  type: 'status';
  message: string;
}

export interface DoneEvent {
  type: 'done';
}

export interface ErrorEvent {
  type: 'error';
  message: string;
}

export type SseEvent =
  | MediaEvent
  | ClaimEvent
  | ResultEvent
  | StatusEvent
  | DoneEvent
  | ErrorEvent;

export interface ClaimState {
  text: string;
  status: 'checking' | 'done';
  verdict?: 'TRUE' | 'FALSE' | 'UNVERIFIABLE';
  explanation?: string;
  source?: string;
}
```

- [ ] **Step 2: Create frontend/lib/api.ts**

```typescript
import type { SseEvent } from '@/types';

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

export async function postVerify(url: string, useVision: boolean = false): Promise<string> {
  const res = await fetch(`${BACKEND_URL}/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, use_vision: useVision }),
  });
  if (!res.ok) throw new Error('Failed to start verification');
  const data = await res.json();
  return data.job_id as string;
}

export function getMediaUrl(jobId: string): string {
  return `${BACKEND_URL}/media/${jobId}`;
}

export function streamResults(
  jobId: string,
  onEvent: (event: SseEvent) => void,
  onError: (err: Error) => void
): () => void {
  const es = new EventSource(`${BACKEND_URL}/verify/stream/${jobId}`);

  es.onmessage = (e) => {
    try {
      const event = JSON.parse(e.data) as SseEvent;
      onEvent(event);
    } catch {
      // ignore malformed events
    }
  };

  es.onerror = () => {
    es.close();
    onError(new Error('Stream connection failed'));
  };

  return () => es.close();
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/types/index.ts frontend/lib/api.ts
git commit -m "feat: frontend types and API client"
```

---

## Task 9: UrlInput Component

**Files:**
- Create: `frontend/components/UrlInput.tsx`

- [ ] **Step 1: Create frontend/components/UrlInput.tsx**

```tsx
'use client';

import { useState } from 'react';

interface Props {
  onVerify: (url: string, useVision: boolean) => void;
  loading: boolean;
}

export default function UrlInput({ onVerify, loading }: Props) {
  const [url, setUrl] = useState('');
  const [useVision, setUseVision] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (trimmed) onVerify(trimmed, useVision);
  };

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
          className="flex-1 px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? 'Verifying...' : 'Verify'}
        </button>
      </form>
      <label className="flex items-center gap-2 cursor-pointer select-none w-fit">
        <input
          type="checkbox"
          checked={useVision}
          onChange={(e) => setUseVision(e.target.checked)}
          disabled={loading}
          className="w-4 h-4 accent-blue-600"
        />
        <span className="text-sm text-gray-600">
          Enable Visual Analysis{' '}
          <span className="text-gray-400">(Gemini Vision — requires GEMINI_API_KEY)</span>
        </span>
      </label>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/UrlInput.tsx
git commit -m "feat: UrlInput component"
```

---

## Task 10: MediaPreview Component

**Files:**
- Create: `frontend/components/MediaPreview.tsx`

- [ ] **Step 1: Create frontend/components/MediaPreview.tsx**

```tsx
'use client';

interface Props {
  mediaType: 'video' | 'image' | null;
  mediaUrl: string | null;
  downloadUrl: string | null;
}

export default function MediaPreview({ mediaType, mediaUrl, downloadUrl }: Props) {
  if (!mediaUrl) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
        <p className="text-gray-400 text-sm">Media preview will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {mediaType === 'video' ? (
        <video
          src={mediaUrl}
          controls
          className="w-full rounded-lg bg-black"
        />
      ) : (
        <img
          src={mediaUrl}
          alt="Instagram post"
          className="w-full rounded-lg object-contain"
        />
      )}
      {downloadUrl && (
        <a
          href={downloadUrl}
          download
          className="block w-full text-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
        >
          Download
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/MediaPreview.tsx
git commit -m "feat: MediaPreview component"
```

---

## Task 11: ClaimCard Component

**Files:**
- Create: `frontend/components/ClaimCard.tsx`

- [ ] **Step 1: Create frontend/components/ClaimCard.tsx**

```tsx
'use client';

import type { ClaimState } from '@/types';

interface Props {
  claim: ClaimState;
}

const VERDICT_STYLES = {
  TRUE: {
    badge: 'bg-green-100 text-green-800',
    border: 'border-green-200 bg-green-50',
    label: '✅ TRUE',
  },
  FALSE: {
    badge: 'bg-red-100 text-red-800',
    border: 'border-red-200 bg-red-50',
    label: '❌ FALSE',
  },
  UNVERIFIABLE: {
    badge: 'bg-yellow-100 text-yellow-800',
    border: 'border-yellow-200 bg-yellow-50',
    label: '⚠️ UNVERIFIABLE',
  },
} as const;

export default function ClaimCard({ claim }: Props) {
  if (claim.status === 'checking') {
    return (
      <div className="p-3 rounded-lg border border-gray-200 bg-gray-50 flex items-center gap-2">
        <span className="animate-spin inline-block">⏳</span>
        <p className="text-gray-600 text-sm truncate">{claim.text}</p>
      </div>
    );
  }

  const style = VERDICT_STYLES[claim.verdict!];

  return (
    <div className={`p-3 rounded-lg border ${style.border}`}>
      <div className="flex items-start gap-2">
        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${style.badge}`}>
          {style.label}
        </span>
      </div>
      <p className="text-gray-800 text-sm mt-2">"{claim.text}"</p>
      {claim.explanation && (
        <p className="text-gray-500 text-xs mt-1">{claim.explanation}</p>
      )}
      {claim.source && (
        <a
          href={claim.source}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500 text-xs hover:underline block mt-1 truncate"
        >
          {claim.source}
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ClaimCard.tsx
git commit -m "feat: ClaimCard component with verdict styles"
```

---

## Task 12: ClaimsList Component

**Files:**
- Create: `frontend/components/ClaimsList.tsx`

- [ ] **Step 1: Create frontend/components/ClaimsList.tsx**

```tsx
'use client';

import ClaimCard from './ClaimCard';
import type { ClaimState } from '@/types';

interface Props {
  claims: ClaimState[];
  status: string;
}

export default function ClaimsList({ claims, status }: Props) {
  const isEmpty = claims.length === 0 && !status;

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-base font-semibold text-gray-800 mb-3">Extracted Claims</h2>

      {status && (
        <p className="text-sm text-gray-400 italic mb-3">{status}</p>
      )}

      {isEmpty ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-gray-300 text-sm">Claims will appear here as they&apos;re verified</p>
        </div>
      ) : (
        <div className="flex-1 space-y-2 overflow-y-auto pr-1">
          {claims.map((claim, i) => (
            <ClaimCard key={i} claim={claim} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/ClaimsList.tsx
git commit -m "feat: ClaimsList component"
```

---

## Task 13: Main Page Assembly

**Files:**
- Modify: `frontend/app/page.tsx`
- Modify: `frontend/app/layout.tsx`

- [ ] **Step 1: Replace frontend/app/layout.tsx**

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Truth Verifier',
  description: 'Fact-check Instagram posts and reels',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
```

- [ ] **Step 2: Replace frontend/app/page.tsx**

```tsx
'use client';

import { useState, useCallback } from 'react';
import UrlInput from '@/components/UrlInput';
import MediaPreview from '@/components/MediaPreview';
import ClaimsList from '@/components/ClaimsList';
import { postVerify, getMediaUrl, streamResults } from '@/lib/api';
import type { ClaimState, SseEvent } from '@/types';

export default function Home() {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [mediaType, setMediaType] = useState<'video' | 'image' | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimState[]>([]);

  const handleVerify = useCallback(async (url: string, useVision: boolean) => {
    setLoading(true);
    setError('');
    setStatus('Connecting to server...');
    setClaims([]);
    setMediaUrl(null);
    setMediaType(null);
    setDownloadUrl(null);

    let cleanup: (() => void) | null = null;

    try {
      const jobId = await postVerify(url, useVision);

      cleanup = streamResults(
        jobId,
        (event: SseEvent) => {
          if (event.type === 'status') {
            setStatus(event.message);
          } else if (event.type === 'media') {
            const url = getMediaUrl(jobId);
            setMediaUrl(url);
            setDownloadUrl(url);
            setMediaType(event.media_type);
          } else if (event.type === 'claim') {
            setClaims((prev) => [...prev, { text: event.text, status: 'checking' }]);
          } else if (event.type === 'result') {
            setClaims((prev) =>
              prev.map((c) =>
                c.text === event.text
                  ? {
                      text: event.text,
                      status: 'done',
                      verdict: event.verdict,
                      explanation: event.explanation,
                      source: event.source,
                    }
                  : c
              )
            );
          } else if (event.type === 'done') {
            setStatus('');
            setLoading(false);
            cleanup?.();
          } else if (event.type === 'error') {
            setError(event.message);
            setStatus('');
            setLoading(false);
            cleanup?.();
          }
        },
        (err) => {
          setError(err.message);
          setStatus('');
          setLoading(false);
        }
      );
    } catch {
      setError('Failed to connect to server. Is it running?');
      setStatus('');
      setLoading(false);
    }
  }, []);

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="text-center pt-4">
          <h1 className="text-3xl font-bold text-gray-900">Truth Verifier</h1>
          <p className="text-gray-500 mt-1 text-sm">
            Paste a public Instagram post or reel URL to fact-check its claims
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-4">
          <UrlInput onVerify={handleVerify} loading={loading} />
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl shadow-sm p-4">
            <h2 className="text-base font-semibold text-gray-800 mb-3">Media</h2>
            <MediaPreview
              mediaType={mediaType}
              mediaUrl={mediaUrl}
              downloadUrl={downloadUrl}
            />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-4 min-h-64">
            <ClaimsList claims={claims} status={status} />
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Create frontend/.env.local from example**

```bash
cp frontend/.env.local.example frontend/.env.local
```

- [ ] **Step 4: Start both servers and test end-to-end**

Terminal 1 (backend):
```bash
cd backend && uvicorn main:app --reload --port 8000
```

Terminal 2 (frontend):
```bash
cd frontend && npm run dev
```

Open `http://localhost:3000`, paste a public Instagram reel URL, click Verify.

Expected: Media loads in left panel, claims stream in with verdicts on the right.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/layout.tsx frontend/app/page.tsx frontend/.env.local.example
git commit -m "feat: main page — wires all components with SSE streaming"
```

---

## Task 14: Render Deployment

**Files:**
- Create: `render.yaml`
- Create: `frontend/next.config.ts` (update)

- [ ] **Step 1: Update frontend/next.config.ts for static export**

```typescript
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone',
};

export default nextConfig;
```

- [ ] **Step 2: Create render.yaml**

```yaml
services:
  - type: web
    name: truth-verifier-backend
    env: docker
    dockerfilePath: ./backend/Dockerfile
    dockerContext: ./backend
    envVars:
      - key: GRADIUM_API_KEY
        sync: false
      - key: TINYFISH_API_KEY
        sync: false
      - key: GEMINI_API_KEY
        sync: false

  - type: web
    name: truth-verifier-frontend
    env: node
    rootDir: frontend
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NEXT_PUBLIC_BACKEND_URL
        value: https://truth-verifier-backend.onrender.com
```

- [ ] **Step 3: Update NEXT_PUBLIC_BACKEND_URL in render.yaml**

Replace `https://truth-verifier-backend.onrender.com` with the actual Render backend URL once the backend service is deployed. Set via Render dashboard under Environment → `NEXT_PUBLIC_BACKEND_URL`.

- [ ] **Step 4: Deploy to Render**

```bash
git add render.yaml frontend/next.config.ts
git commit -m "feat: Render deployment config"
git push origin main
```

In Render dashboard:
1. New → Blueprint → connect repo → Render reads `render.yaml` and creates both services
2. Set `GRADIUM_API_KEY`, `TINYFISH_API_KEY`, `GEMINI_API_KEY` in backend service env vars
3. Set `NEXT_PUBLIC_BACKEND_URL` to the deployed backend URL in frontend service env vars
4. Redeploy frontend after setting the URL

Expected: Both services live at `https://truth-verifier-frontend.onrender.com`

---

## Run All Tests

```bash
cd "/Users/gnaneshwarvanam/Downloads/Coding Projects/truth_verifier"
python -m pytest tests/ -v
```

Expected: 11 tests PASSED across downloader, claims_parser, fact_checker.
