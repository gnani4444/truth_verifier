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

            # For image posts, vision is required — bail early if it's off
            if media_type == "image" and not use_vision:
                yield {"data": json.dumps({
                    "type": "error",
                    "message": "This is an image post — enable Visual Analysis above to analyze it.",
                    "vision_required": True,
                })}
                return

            # Step 2: Extract content (Gradium STT always; Gemini Vision only if use_vision)
            status_msg = "Extracting audio + visuals..." if use_vision else "Extracting audio..."
            yield {"data": json.dumps({"type": "status", "message": status_msg})}
            raw_text = await extract_text(media_path, media_type, use_vision=use_vision)

            if not raw_text.strip():
                yield {"data": json.dumps({
                    "type": "error",
                    "message": "No spoken audio detected in this video. Enable Visual Analysis to analyze the video frames instead.",
                    "vision_required": True,
                })}
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
