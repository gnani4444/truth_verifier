# Truth Verifier

Fact-check Instagram posts in real time. Paste a public Instagram URL and get a verdict — **TRUE**, **FALSE**, or **UNVERIFIABLE** — for every claim in the post.

## How It Works

1. **Download** — the backend fetches the Instagram post (video or image) via yt-dlp
2. **Extract** — audio is pulled with ffmpeg and transcribed using Gradium STT; optionally, video keyframes and images are analyzed with Gemini Vision
3. **Parse claims** — TinyFish identifies distinct, verifiable claims from the extracted text
4. **Fact-check** — each claim is searched and scored against web sources via TinyFish Search + Fetch APIs
5. **Stream results** — verdicts are pushed to the frontend over SSE as they complete

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.13, FastAPI, SSE |
| Frontend | Next.js 16, TypeScript, Tailwind CSS, Supabase |
| Speech-to-Text | Gradium STT |
| Vision (optional) | Gemini 2.0 Flash |
| Web search | TinyFish Search + Fetch APIs |
| Download | yt-dlp, ffmpeg |
| Deploy | Render (Docker) |

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- ffmpeg installed and on `PATH`

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in your API keys
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # set NEXT_PUBLIC_BACKEND_URL
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `GRADIUM_API_KEY` | Yes | Gradium STT for audio transcription |
| `TINYFISH_API_KEY` | Yes | TinyFish for claim parsing and web search |
| `GEMINI_API_KEY` | No | Gemini Vision — only needed when Visual Analysis is enabled |

### Frontend (`frontend/.env.local`)

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BACKEND_URL` | Backend base URL (default: `http://localhost:8000`) |

## Running Tests

```bash
pytest tests/
```

## Deploying to Render

The repo includes a `render.yaml` for one-click backend deployment:

1. Push to GitHub
2. Create a new Render service from the repo
3. Set `GRADIUM_API_KEY`, `TINYFISH_API_KEY`, and optionally `GEMINI_API_KEY` in the Render dashboard

## Project Structure

```
truth_verifier/
├── backend/
│   ├── main.py           # FastAPI app + SSE streaming
│   ├── downloader.py     # yt-dlp Instagram download
│   ├── extractor.py      # audio transcription + Gemini Vision
│   ├── claims_parser.py  # extract claims from raw text
│   ├── fact_checker.py   # TinyFish search + verdict scoring
│   ├── models.py         # Pydantic request/response models
│   └── Dockerfile
├── frontend/             # Next.js app
├── tests/                # pytest test suite
└── render.yaml           # Render deployment config
```
