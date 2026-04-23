# Truth Verifier — Design Spec
**Date:** 2026-04-20 (updated)

## Overview

A web app that takes a public Instagram post or reel URL, downloads the media, extracts all spoken content via Gradium STT, optionally analyzes visual frames via Gemini Vision (user-toggled, **default OFF**), extracts factual claims via TinyFish, and fact-checks each claim via TinyFish. Results stream progressively with TRUE / FALSE / UNVERIFIABLE verdicts and source links.

---

## Stack

| Layer | Technology | Notes |
|-------|-----------|-------|
| Frontend | Next.js (TypeScript, Tailwind) | Render |
| Backend | Python FastAPI | Render (Docker) |
| Audio transcription | Gradium STT API | Always on for videos |
| Visual analysis | Gemini Vision API | **Optional — OFF by default**, user toggles on |
| Claim extraction | TinyFish Agent API (`/run-sse`) | Replaces Gemini for parsing |
| Fact-checking | TinyFish Agent API (`/run-sse`) | Sequential per claim |
| Media download | yt-dlp + ffmpeg | Public posts only |

---

## Architecture

```
User (browser)
    │
    ▼
Next.js UI (Render)
    │  POST /verify  { url, use_vision: false }
    ▼
FastAPI Backend (Render)
    │
    ├── 1. yt-dlp → download video/image (public posts only)
    │
    ├── 2a. Video → ffmpeg extract audio → Gradium STT → spoken text
    ├── 2b. [use_vision=true only] Video → ffmpeg extract 3 keyframes → Gemini Vision → visual text
    ├── 2c. [use_vision=true only] Image → Gemini Vision → visual text
    │
    ├── 3. TinyFish Agent → extract distinct factual claims from text → list[str]
    │
    ├── 4. For each claim (sequential):
    │       TinyFish Agent /run-sse → TRUE / FALSE / UNVERIFIABLE
    │       Stream result to frontend via SSE
    │
    └── SSE stream → Next.js UI (results appear progressively)
```

---

## Backend Modules

- **`downloader.py`** — yt-dlp wrapper; returns local file path + media type (video/image)
- **`extractor.py`** — Gradium STT for audio + optional Gemini Vision for frames/images; returns raw text string
- **`claims_parser.py`** — TinyFish Agent call: takes raw text, returns list of distinct factual claims
- **`fact_checker.py`** — Iterates claims, calls TinyFish `/run-sse` for each, yields structured SSE dicts
- **`main.py`** — FastAPI app; defines routes, SSE endpoint, in-memory job store

---

## API Contract

### Endpoints

```
POST /verify
Body: { "url": "https://instagram.com/reel/...", "use_vision": false }
Response: { "job_id": "abc123" }

GET /media/{job_id}
Response: serves downloaded media file for browser preview

GET /verify/stream/{job_id}
Response: SSE stream of events
```

### SSE Event Types

```json
{ "type": "media",  "media_type": "video", "filename": "reel.mp4" }
{ "type": "status", "message": "Extracting audio..." }
{ "type": "claim",  "text": "Lemon cures cancer", "status": "checking" }
{ "type": "result", "text": "Lemon cures cancer", "verdict": "FALSE",
  "explanation": "No clinical evidence supports this claim.",
  "source": "https://..." }
{ "type": "done" }
{ "type": "error",  "message": "Could not download post" }
```

---

## UI Layout

```
┌───────────────────────────────────────────────────┐
│  Truth Verifier                                   │
│                                                   │
│  [ Instagram URL input           ] [Verify]       │
│  [ ] Enable Visual Analysis (Gemini Vision)       │
└───────────────────────────────────────────────────┘

┌──────────────────┐  ┌───────────────────────────┐
│                  │  │ Extracted Claims           │
│  Video/Image     │  │                            │
│  preview         │  │ ✅ "Biden is president"    │
│                  │  │    TRUE — source: ...      │
│  [Download]      │  │                            │
│                  │  │ ❌ "Lemon cures cancer"    │
└──────────────────┘  │    FALSE — source: ...     │
                      │                            │
                      │ ⏳ Checking claim 3...     │
                      └───────────────────────────┘
```

**UI behavior:**
- Paste URL → optionally check "Enable Visual Analysis" → click Verify
- Visual analysis checkbox is unchecked by default
- Left panel: media preview + download button (appears after download)
- Right panel: claims stream in live, each showing verdict + explanation + source
- Loading steps shown: "Downloading… → Extracting… → Finding claims… → Checking claims…"
- Render cold start message: "Connecting to server…" if response takes >5s

---

## Environment Variables

```
GRADIUM_API_KEY         # required — audio transcription
TINYFISH_API_KEY        # required — claim extraction + fact-checking
GEMINI_API_KEY          # optional — only needed when use_vision=true
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Private Instagram account | Error: "This post is private or requires login" |
| Invalid / deleted URL | Error: "Could not fetch post — check the URL" |
| Video has no audio | Skip Gradium; continue with visual (if enabled) or error |
| Gradium returns empty transcript | Fall through to visual (if enabled); error if no text at all |
| use_vision=false + no audio | Error: "No audio found. Enable Visual Analysis to analyze images." |
| TinyFish finds no claims | Show "No verifiable claims found in this content" |
| TinyFish times out on claim check | Mark as ⚠️ UNVERIFIABLE, continue to next claim |
| TinyFish rate limit hit | Pause 2s, retry once, then mark UNVERIFIABLE |
| No claims extracted | Show "Nothing to fact-check" |
| GEMINI_API_KEY missing when use_vision=true | Error: "Gemini API key not configured" |

---

## Job State Storage

Jobs are stored in an **in-memory Python dict** on the FastAPI process (keyed by `job_id`, UUID). Sufficient because:
- Render free tier runs a single instance
- Jobs are short-lived (complete in under 2 minutes)
- No persistence needed across restarts

---

## Constraints

- Public Instagram posts only (no login, no private accounts)
- Max ~3 minute videos (Gradium processing time)
- TinyFish free tier: 500 steps; claim extraction ~3–5 steps + each claim check ~1–3 steps
- Gemini Vision only loaded when `use_vision=true` and `GEMINI_API_KEY` is set
