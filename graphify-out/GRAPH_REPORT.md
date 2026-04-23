# Graph Report - /Users/gnaneshwarvanam/Downloads/Coding_Projects/truth_verifier  (2026-04-22)

## Corpus Check
- Corpus is ~18,656 words - fits in a single context window. You may not need a graph.

## Summary
- 183 nodes · 237 edges · 17 communities detected
- Extraction: 88% EXTRACTED · 12% INFERRED · 0% AMBIGUOUS · INFERRED: 29 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Core Pipeline & Planning Docs|Core Pipeline & Planning Docs]]
- [[_COMMUNITY_Auth, Tiers & Admin Layer|Auth, Tiers & Admin Layer]]
- [[_COMMUNITY_Fact Checker Engine|Fact Checker Engine]]
- [[_COMMUNITY_Claims Parser Engine|Claims Parser Engine]]
- [[_COMMUNITY_Next.js Pages & API Routes|Next.js Pages & API Routes]]
- [[_COMMUNITY_Media Extraction Engine|Media Extraction Engine]]
- [[_COMMUNITY_FastAPI Backend Core|FastAPI Backend Core]]
- [[_COMMUNITY_Instagram Downloader|Instagram Downloader]]
- [[_COMMUNITY_Fact Checker Tests|Fact Checker Tests]]
- [[_COMMUNITY_Admin Logs UI|Admin Logs UI]]
- [[_COMMUNITY_Main UI Pages|Main UI Pages]]
- [[_COMMUNITY_Frontend API Client|Frontend API Client]]
- [[_COMMUNITY_Auth Middleware|Auth Middleware]]
- [[_COMMUNITY_App Layout|App Layout]]
- [[_COMMUNITY_URL Input Component|URL Input Component]]
- [[_COMMUNITY_Supabase Client|Supabase Client]]
- [[_COMMUNITY_ASGI Server|ASGI Server]]

## God Nodes (most connected - your core abstractions)
1. `GET()` - 12 edges
2. `check_claim()` - 12 edges
3. `parse_claims()` - 10 edges
4. `Auth, Tiers & Logging Design Spec` - 10 edges
5. `Auth, Tiers & Logging Implementation Plan` - 9 edges
6. `Truth Verifier Implementation Plan` - 8 edges
7. `download_instagram()` - 7 edges
8. `Truth Verifier Design Spec` - 7 edges
9. `POST()` - 6 edges
10. `createClient()` - 6 edges

## Surprising Connections (you probably didn't know these)
- `Vercel Deployment (frontend migration from Render)` --semantically_similar_to--> `Vercel Deployment Platform`  [INFERRED] [semantically similar]
  docs/superpowers/plans/2026-04-22-auth-tiers-logging.md → frontend/README.md
- `Render Deployment Configuration (render.yaml)` --semantically_similar_to--> `Vercel Deployment Platform`  [INFERRED] [semantically similar]
  docs/superpowers/plans/2026-04-20-truth-verifier.md → frontend/README.md
- `FastAPI Main App with SSE Endpoint` --references--> `FastAPI Web Framework`  [EXTRACTED]
  docs/superpowers/plans/2026-04-20-truth-verifier.md → backend/requirements.txt
- `FastAPI Main App with SSE Endpoint` --references--> `SSE-Starlette (Server-Sent Events)`  [EXTRACTED]
  docs/superpowers/plans/2026-04-20-truth-verifier.md → backend/requirements.txt
- `FastAPI Main App with SSE Endpoint` --references--> `Pydantic Data Validation`  [EXTRACTED]
  docs/superpowers/plans/2026-04-20-truth-verifier.md → backend/requirements.txt

## Hyperedges (group relationships)
- **Core Truth Verifier Processing Pipeline** — plan_downloader_module, plan_extractor_module, plan_claims_parser_module, plan_fact_checker_module, plan_sse_streaming_architecture [EXTRACTED 0.97]
- **Supabase Data Layer (Auth + Cache + Logs)** — spec_profiles_table, spec_processed_reels_table, spec_api_logs_table, spec_handle_new_user_trigger [EXTRACTED 0.95]
- **Next.js API Gateway (Auth + Tier + Cache + SSE Proxy)** — plan_middleware_session_guard, plan_api_verify_route, plan_edge_sse_proxy_route, plan_admin_api_routes [EXTRACTED 0.93]

## Communities

### Community 0 - "Core Pipeline & Planning Docs"
Cohesion: 0.09
Nodes (27): Next.js Agent Rules (Breaking Changes Warning), Claims Parser Module (TinyFish Agent), Downloader Module (yt-dlp wrapper), Extractor Module (Gradium STT + Gemini Vision), Fact Checker Module (TinyFish Agent), FastAPI Main App with SSE Endpoint, Frontend React Components (UrlInput, MediaPreview, ClaimCard, ClaimsList), Render Deployment Configuration (render.yaml) (+19 more)

### Community 1 - "Auth, Tiers & Admin Layer"
Cohesion: 0.18
Nodes (20): Admin API Routes (update-tier, logs), Admin Panel Page (Users Table + Logs Table), Next.js POST /api/verify Route (Auth + Tier + Cache Gate), Auth, Tiers & Logging Implementation Plan, Edge Runtime SSE Proxy Route (/api/verify/stream/[jobId]), Next.js Middleware Session Guard, Remove FastAPI File-Based Cache (migrate to Supabase), Supabase Project Setup (profiles, processed_reels, api_logs) (+12 more)

### Community 2 - "Fact Checker Engine"
Cohesion: 0.19
Nodes (12): check_claim(), check_claims(), _fetch_pages(), TinyFish Search API — returns list of {title, snippet, url}., Async generator: yields claim and result SSE dicts sequentially., TinyFish Fetch API — returns list of {url, content} for each fetched page., Return (support_score, deny_score) for a block of text., Fact-check a claim using TinyFish Search + Fetch APIs:     1. Search for the cla (+4 more)

### Community 3 - "Claims Parser Engine"
Cohesion: 0.27
Nodes (11): parse_claims(), _parse_tinyfish_result(), Fallback: split text into non-trivial sentences to use as claims directly., Try every reasonable format TinyFish might return a JSON array in., Use TinyFish Agent to extract distinct factual claims. Returns list of strings., _sentences_from_text(), build_mock_httpx_with_result(), test_parse_claims_handles_json_array_result() (+3 more)

### Community 4 - "Next.js Pages & API Routes"
Cohesion: 0.14
Nodes (4): AdminPage(), handleSignOut(), POST(), createClient()

### Community 5 - "Media Extraction Engine"
Cohesion: 0.29
Nodes (10): _analyze_visuals(), _extract_audio_text(), _extract_keyframes(), extract_text(), Stream WAV file through Gradium STT. Returns transcript string., Extract textual content from media. Gemini Vision only runs if use_vision=True., Extract audio from video with ffmpeg, transcribe with Gradium. Returns text., Extract evenly-spaced keyframes from video. Returns list of JPEG file paths. (+2 more)

### Community 6 - "FastAPI Backend Core"
Cohesion: 0.29
Nodes (6): BaseModel, get_media(), start_verify(), stream_verify(), VerifyRequest, VerifyResponse

### Community 7 - "Instagram Downloader"
Cohesion: 0.38
Nodes (6): download_instagram(), Download a public Instagram post. Returns (file_path, media_type)., make_mock_ydl(), test_download_image_returns_jpg_and_image_type(), test_download_raises_on_ydl_error(), test_download_video_returns_mp4_and_video_type()

### Community 8 - "Fact Checker Tests"
Cohesion: 0.57
Nodes (6): build_mock_httpx(), make_sse_lines(), test_check_claim_returns_false_verdict(), test_check_claim_returns_true_verdict(), test_check_claim_returns_unverifiable_on_timeout(), test_check_claims_yields_claim_event_then_result_event()

### Community 9 - "Admin Logs UI"
Cohesion: 0.53
Nodes (4): handleFilterChange(), handleNext(), handlePrev(), toggleRow()

### Community 10 - "Main UI Pages"
Cohesion: 0.4
Nodes (1): handleSubmit()

### Community 11 - "Frontend API Client"
Cohesion: 0.6
Nodes (3): getMediaUrl(), postVerify(), streamResults()

### Community 12 - "Auth Middleware"
Cohesion: 0.67
Nodes (1): middleware()

### Community 13 - "App Layout"
Cohesion: 0.67
Nodes (1): RootLayout()

### Community 14 - "URL Input Component"
Cohesion: 0.67
Nodes (1): UrlInput()

### Community 15 - "Supabase Client"
Cohesion: 0.67
Nodes (1): createClient()

### Community 36 - "ASGI Server"
Cohesion: 1.0
Nodes (1): Uvicorn ASGI Server

## Knowledge Gaps
- **29 isolated node(s):** `Fallback: split text into non-trivial sentences to use as claims directly.`, `Try every reasonable format TinyFish might return a JSON array in.`, `Use TinyFish Agent to extract distinct factual claims. Returns list of strings.`, `Download a public Instagram post. Returns (file_path, media_type).`, `TinyFish Search API — returns list of {title, snippet, url}.` (+24 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **Thin community `Main UI Pages`** (5 nodes): `page.tsx`, `page.tsx`, `handleSubmit()`, `page.tsx`, `page.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Auth Middleware`** (3 nodes): `middleware.ts`, `middleware()`, `middleware.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `App Layout`** (3 nodes): `layout.tsx`, `RootLayout()`, `layout.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `URL Input Component`** (3 nodes): `UrlInput.tsx`, `UrlInput()`, `UrlInput.tsx`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `Supabase Client`** (3 nodes): `createClient()`, `client.ts`, `client.ts`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.
- **Thin community `ASGI Server`** (1 nodes): `Uvicorn ASGI Server`
  Too small to be a meaningful cluster - may be noise or needs more connections extracted.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `GET()` connect `Fact Checker Engine` to `Claims Parser Engine`, `Next.js Pages & API Routes`, `FastAPI Backend Core`, `Instagram Downloader`?**
  _High betweenness centrality (0.127) - this node is a cross-community bridge._
- **Why does `parse_claims()` connect `Claims Parser Engine` to `Fact Checker Engine`?**
  _High betweenness centrality (0.055) - this node is a cross-community bridge._
- **Why does `check_claim()` connect `Fact Checker Engine` to `Fact Checker Tests`?**
  _High betweenness centrality (0.054) - this node is a cross-community bridge._
- **Are the 8 inferred relationships involving `GET()` (e.g. with `createClient()` and `parse_claims()`) actually correct?**
  _`GET()` has 8 INFERRED edges - model-reasoned connections that need verification._
- **Are the 4 inferred relationships involving `check_claim()` (e.g. with `test_check_claim_returns_true_verdict()` and `test_check_claim_returns_false_verdict()`) actually correct?**
  _`check_claim()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **Are the 5 inferred relationships involving `parse_claims()` (e.g. with `test_parse_claims_returns_list_of_strings()` and `test_parse_claims_returns_empty_for_blank_text()`) actually correct?**
  _`parse_claims()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Fallback: split text into non-trivial sentences to use as claims directly.`, `Try every reasonable format TinyFish might return a JSON array in.`, `Use TinyFish Agent to extract distinct factual claims. Returns list of strings.` to the rest of the system?**
  _29 weakly-connected nodes found - possible documentation gaps or missing edges._