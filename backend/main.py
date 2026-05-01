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
from fact_checker import check_claim
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

    async def _run_with_heartbeat(coro, status_msg: str, interval: float = 8.0):
        """Run an async coroutine, yielding status pings every `interval` seconds."""
        task = asyncio.create_task(coro)
        events = []
        while not task.done():
            try:
                await asyncio.wait_for(asyncio.shield(task), timeout=interval)
            except asyncio.TimeoutError:
                events.append({"data": json.dumps({"type": "status", "message": status_msg})})
        return task.result(), events

    async def event_generator():
        try:
            url = job["url"]

            # Step 1: Download media (sync — run in thread, heartbeat every 8 s)
            yield {"data": json.dumps({"type": "status", "message": "Downloading post..."})}
            try:
                (media_path, media_type), dl_pings = await _run_with_heartbeat(
                    asyncio.to_thread(download_instagram, url),
                    "Downloading post...",
                )
                for ping in dl_pings:
                    yield ping
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

            # For image posts, vision is required — bail early if it's off
            if media_type == "image" and not use_vision:
                yield {"data": json.dumps({
                    "type": "error",
                    "message": "This is an image post — enable Visual Analysis above to analyze it.",
                    "vision_required": True,
                })}
                return

            # Step 2: Extract content — heartbeat every 10 s (transcription can be slow)
            status_msg = "Extracting audio + visuals..." if use_vision else "Transcribing audio..."
            yield {"data": json.dumps({"type": "status", "message": status_msg})}
            raw_text, extract_pings = await _run_with_heartbeat(
                extract_text(media_path, media_type, use_vision=use_vision),
                status_msg,
                interval=10.0,
            )
            for ping in extract_pings:
                yield ping

            if not raw_text.strip():
                yield {"data": json.dumps({
                    "type": "error",
                    "message": "No spoken audio detected in this video. Enable Visual Analysis to analyze the video frames instead.",
                    "vision_required": True,
                })}
                return

            raw_text = raw_text.strip()
            yield {"data": json.dumps({"type": "text", "content": raw_text})}

            # Step 3: Find claims via TinyFish — heartbeat every 10 s
            yield {"data": json.dumps({"type": "status", "message": "Finding claims..."})}
            claims, claims_pings = await _run_with_heartbeat(
                parse_claims(raw_text),
                "Analyzing transcript...",
                interval=10.0,
            )
            for ping in claims_pings:
                yield ping

            if not claims:
                yield {"data": json.dumps({"type": "error", "message": "No verifiable claims found in this content"})}
                return

            # Step 4: Fact-check each claim with heartbeat pings per claim
            for claim in claims:
                yield {"data": json.dumps({"type": "claim", "text": claim, "status": "checking"})}
                result, check_pings = await _run_with_heartbeat(
                    check_claim(claim),
                    f"Checking: {claim[:60]}...",
                    interval=8.0,
                )
                for ping in check_pings:
                    yield ping
                yield {"data": json.dumps({
                    "type": "result",
                    "text": claim,
                    "verdict": result["verdict"],
                    "explanation": result["explanation"],
                    "source": result["source"],
                })}

            yield {"data": json.dumps({"type": "done"})}

        except Exception as e:
            yield {"data": json.dumps({"type": "error", "message": str(e)})}

    return EventSourceResponse(event_generator())
