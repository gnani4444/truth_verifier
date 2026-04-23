# Auth, Tiers & Logging Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Supabase email/password auth, free/pro/admin tiers, shared URL cache in Supabase Postgres, and detailed API logging to Truth Verifier; move Next.js frontend from Render to Vercel.

**Architecture:** Next.js on Vercel handles auth, tier enforcement, caching, and logging via API routes; Python FastAPI on Render stays unchanged and handles all media processing. A Next.js POST route gates every verification request; an Edge Runtime GET route proxies the FastAPI SSE stream while writing results to Supabase on completion.

**Tech Stack:** Next.js 14 (App Router), Supabase Auth, `@supabase/ssr`, `@supabase/supabase-js`, Supabase Postgres, Vercel (free), Render (FastAPI — unchanged)

---

## File Map

```
frontend/
  middleware.ts                          CREATE — session guard, /admin tier check
  lib/supabase/
    client.ts                            CREATE — browser Supabase client
    server.ts                            CREATE — server-side Supabase client
  app/
    login/page.tsx                       CREATE — email/password login form
    register/page.tsx                    CREATE — sign-up form
    admin/page.tsx                       CREATE — admin panel (users + logs)
    api/
      verify/route.ts                    CREATE — POST: auth + tier + cache check → forward to FastAPI
      verify/stream/[jobId]/route.ts     CREATE — GET Edge: proxy FastAPI SSE + write Supabase on done
      admin/
        update-tier/route.ts             CREATE — POST admin only: update profiles.tier
        logs/route.ts                    CREATE — GET admin only: paginated api_logs
  page.tsx                               MODIFY — add user header + logout + handle cached response
  lib/api.ts                             MODIFY — point to /api/verify instead of FastAPI directly
  package.json                           MODIFY — add @supabase/ssr, @supabase/supabase-js
  .env.local                             MODIFY — add Supabase + BACKEND_URL env vars
backend/
  cache.py                               DELETE
  main.py                                MODIFY — remove cache imports + force_refresh logic
```

---

## Task 1: Supabase Project Setup

**Files:** Supabase dashboard (no code files in this task)

- [ ] **Step 1: Create Supabase project**

  Go to https://supabase.com → New project → free tier. Note the Project URL and anon key from Settings → API.

- [ ] **Step 2: Run schema SQL**

  In the Supabase SQL editor, run the full schema from the spec:
  `docs/superpowers/specs/2026-04-22-auth-tiers-logging-design.md` — Database Schema section.

  This creates: `profiles` table, `processed_reels` table, `api_logs` table, `handle_new_user` trigger function, and the `idx_api_logs_user_date` index.

- [ ] **Step 3: Verify tables exist**

  In Supabase Table Editor confirm `profiles`, `processed_reels`, and `api_logs` all appear.

- [ ] **Step 4: Disable email confirmation (for development)**

  Supabase Dashboard → Authentication → Providers → Email → disable "Confirm email". This allows instant login after sign-up.

---

## Task 2: Install Dependencies + Supabase Client Files

**Files:**
- Modify: `frontend/package.json`
- Create: `frontend/lib/supabase/client.ts`
- Create: `frontend/lib/supabase/server.ts`
- Modify: `frontend/.env.local`

- [ ] **Step 1: Install Supabase packages**

  ```bash
  cd frontend
  npm install @supabase/ssr @supabase/supabase-js
  ```

  Expected: packages added to `node_modules`, `package.json` updated.

- [ ] **Step 2: Add env vars to `.env.local`**

  Add to `frontend/.env.local`:
  ```
  NEXT_PUBLIC_SUPABASE_URL=<your Supabase project URL>
  NEXT_PUBLIC_SUPABASE_ANON_KEY=<your Supabase anon key>
  SUPABASE_SERVICE_ROLE_KEY=<your Supabase service role key>
  BACKEND_URL=http://localhost:8000
  ```

  `NEXT_PUBLIC_*` vars are safe to expose in the browser. `SUPABASE_SERVICE_ROLE_KEY` is server-only — never use it in client components.

- [ ] **Step 3: Create `frontend/lib/supabase/client.ts`**

  Export a `createClient()` function using `createBrowserClient` from `@supabase/ssr`. Uses `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

- [ ] **Step 4: Create `frontend/lib/supabase/server.ts`**

  Export a `createClient()` function using `createServerClient` from `@supabase/ssr`. Reads/writes cookies via Next.js `cookies()` from `next/headers`. Uses same public env vars.

- [ ] **Step 5: Commit**

  ```bash
  git add frontend/package.json frontend/package-lock.json frontend/lib/supabase/ frontend/.env.local
  git commit -m "feat: add Supabase client setup"
  ```

---

## Task 3: Next.js Middleware (Session Guard)

**Files:**
- Create: `frontend/middleware.ts`

- [ ] **Step 1: Create `frontend/middleware.ts`**

  The middleware must:
  1. Create a Supabase server client that can refresh the session cookie on every request.
  2. Call `supabase.auth.getUser()` to check if a session exists.
  3. If no session and the request is not for `/login` or `/register` or `/api/auth/*`: redirect to `/login`.
  4. If request is for `/admin`: also fetch `profiles` row and check `tier = 'admin'`. If not admin, return `NextResponse.next()` (page.tsx will show 404).
  5. Always return the response with updated cookies (session refresh).

  Export a `config` matcher that runs on all routes except `/_next/`, `/favicon.ico`, and static files.

- [ ] **Step 2: Start the dev server and verify redirect**

  ```bash
  cd frontend && npm run dev
  ```

  Open http://localhost:3000 — expect redirect to `/login` (which returns 404 for now — that's fine).

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/middleware.ts
  git commit -m "feat: add session guard middleware"
  ```

---

## Task 4: Login Page

**Files:**
- Create: `frontend/app/login/page.tsx`

- [ ] **Step 1: Create `frontend/app/login/page.tsx`**

  `'use client'` component with:
  - Email input, password input, submit button
  - Calls `supabase.auth.signInWithPassword({ email, password })`
  - On success: `router.push('/')` via `useRouter`
  - On error: display error message below the form
  - Link to `/register` ("Don't have an account? Sign up")
  - Style with Tailwind to match the existing app's white card aesthetic

- [ ] **Step 2: Verify login page renders**

  Open http://localhost:3000/login — expect a centered login form.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/app/login/
  git commit -m "feat: add login page"
  ```

---

## Task 5: Register Page

**Files:**
- Create: `frontend/app/register/page.tsx`

- [ ] **Step 1: Create `frontend/app/register/page.tsx`**

  `'use client'` component with:
  - Email input, password input, submit button
  - Calls `supabase.auth.signUp({ email, password })`
  - On success: `router.push('/')` via `useRouter`
  - On error: display error message below the form
  - Link to `/login` ("Already have an account? Sign in")
  - Same Tailwind card style as login page

- [ ] **Step 2: Register `vanamgnaneshwar@gmail.com`**

  Open http://localhost:3000/register and register with `vanamgnaneshwar@gmail.com`. After sign-up, check Supabase Table Editor → `profiles` → confirm `tier = 'admin'`.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/app/register/
  git commit -m "feat: add register page"
  ```

---

## Task 6: POST /api/verify Route

**Files:**
- Create: `frontend/app/api/verify/route.ts`

- [ ] **Step 1: Create `frontend/app/api/verify/route.ts`**

  `export async function POST(req: Request)` — Node.js runtime (default).

  Logic in order:
  1. Parse body: `{ url, use_vision, force_refresh }`.
  2. Create Supabase server client and call `getUser()`. Return 401 if no user.
  3. Fetch `profiles` row for `user.id`. Get `tier`.
  4. If `tier === 'free'`: count `api_logs` rows where `user_id = user.id` AND `created_at >= DATE_TRUNC('day', NOW())`. If count ≥ 5, return 429 JSON `{ error: "Daily limit reached (5/day). Upgrade to Pro for unlimited access." }`.
  5. If `force_refresh`: delete from `processed_reels` where `url = ? AND use_vision = ?`.
  6. Query `processed_reels` where `url = ? AND use_vision = ?`. If row found:
     - Insert row into `api_logs` with `user_id`, `url`, `use_vision`, `claims` from cached row.
     - Return 200 JSON `{ job_id: null, claims: row.claims, extracted_text: row.extracted_text }`.
  7. POST to `${BACKEND_URL}/verify` with `{ url, use_vision, force_refresh: false }`. Return 502 if FastAPI unreachable.
  8. Return 200 JSON `{ job_id: data.job_id, claims: null }`.

- [ ] **Step 2: Test with curl (unauthenticated)**

  ```bash
  curl -X POST http://localhost:3000/api/verify \
    -H "Content-Type: application/json" \
    -d '{"url":"https://instagram.com/reel/test","use_vision":false}'
  ```

  Expected: `{"error":"Unauthorized"}` with status 401.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/app/api/verify/route.ts
  git commit -m "feat: add /api/verify route with auth + tier + cache"
  ```

---

## Task 7: GET /api/verify/stream/[jobId] Edge Route

**Files:**
- Create: `frontend/app/api/verify/stream/[jobId]/route.ts`

- [ ] **Step 1: Create `frontend/app/api/verify/stream/[jobId]/route.ts`**

  At the top: `export const runtime = 'edge'` — required to avoid Vercel's 10s timeout.

  `export async function GET(req: Request, { params })` receiving `jobId` from params and `url` + `use_vision` from `req.url` search params.

  Logic:
  1. Fetch `${BACKEND_URL}/verify/stream/${jobId}` from FastAPI.
  2. Pipe the response body as a `ReadableStream` back to the client with headers:
     `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`.
  3. While piping, accumulate `result` events into a `claimResults` array and the `text` event content.
  4. When a `done` event is received:
     - Upsert into `processed_reels` (`url`, `use_vision`, `extracted_text`, `claims`) using the Supabase service role key.
     - Insert into `api_logs` (`user_id`, `url`, `use_vision`, `claims`).
     - Get `user_id` by reading the session cookie via `createServerClient` (Edge-compatible).
  5. Forward the `done` event to the client then close the stream.

  For Supabase in Edge Runtime: import `createServerClient` from `@supabase/ssr` and use `cookies()` from `next/headers` (works in Edge). Use `SUPABASE_SERVICE_ROLE_KEY` for DB writes (server-only).

- [ ] **Step 2: Commit**

  ```bash
  git add frontend/app/api/verify/stream/
  git commit -m "feat: add Edge SSE proxy route with Supabase cache + log writes"
  ```

---

## Task 8: Update Frontend (lib/api.ts + page.tsx)

**Files:**
- Modify: `frontend/lib/api.ts`
- Modify: `frontend/app/page.tsx`

- [ ] **Step 1: Update `frontend/lib/api.ts`**

  Change `postVerify()` to:
  - POST to `/api/verify` (no `BACKEND_URL` prefix — this is a Next.js route).
  - Return `{ jobId: string | null, claims: ClaimResult[] | null }` instead of just a string.
  - Throw a typed error with the server's `error` message on non-2xx (so 429 surfaces cleanly).

  Change `streamResults()` to:
  - Open `EventSource` to `/api/verify/stream/${jobId}?url=${encodeURIComponent(url)}&use_vision=${useVision}`.

  Change `getMediaUrl()` to:
  - Still point to `${BACKEND_URL}/media/${jobId}` (FastAPI serves media directly — no change needed).
  - `BACKEND_URL` should now come from a non-`NEXT_PUBLIC_` env var since it's only called from server components, OR keep it as `NEXT_PUBLIC_BACKEND_URL` for the media preview (client-side).

- [ ] **Step 2: Update `frontend/app/page.tsx`**

  Changes needed:
  1. Import `createClient` from `@/lib/supabase/client` for logout.
  2. Add a header bar showing the logged-in user's email and a "Sign out" button that calls `supabase.auth.signOut()` then `router.push('/login')`.
  3. Update `handleVerify` to handle the new `postVerify` return shape:
     - If `claims !== null` (cache hit): directly populate the `claims` state with `status: 'done'` for each claim — no EventSource needed.
     - If `jobId !== null` (cache miss): open EventSource as before.
  4. Pass `url` and `use_vision` to `streamResults()` so it can forward them to the stream route.
  5. Show a "Daily limit reached" error if `postVerify` throws a 429 error.

- [ ] **Step 3: Test full flow in browser**

  1. Log in at http://localhost:3000/login
  2. Submit a public Instagram reel URL
  3. Verify claims stream in
  4. Submit the same URL again — verify "Using cached results..." status appears instantly

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/lib/api.ts frontend/app/page.tsx
  git commit -m "feat: wire frontend to Next.js API routes with cache + auth"
  ```

---

## Task 9: Admin API Routes

**Files:**
- Create: `frontend/app/api/admin/update-tier/route.ts`
- Create: `frontend/app/api/admin/logs/route.ts`

- [ ] **Step 1: Create `frontend/app/api/admin/update-tier/route.ts`**

  `export async function POST(req: Request)`:
  1. Validate session — 401 if missing.
  2. Fetch `profiles` for the calling user — 403 if `tier !== 'admin'`.
  3. Parse body: `{ userId: string, tier: 'free' | 'pro' | 'admin' }`.
  4. Use Supabase service role client to run: `UPDATE profiles SET tier = ? WHERE id = ?`.
  5. Return 200 `{ success: true }`.

- [ ] **Step 2: Create `frontend/app/api/admin/logs/route.ts`**

  `export async function GET(req: Request)`:
  1. Validate session — 401 if missing.
  2. Check `profiles.tier === 'admin'` — 403 if not.
  3. Parse query params: `page` (default 1), `user` (email filter), `from` (date), `to` (date).
  4. Query `api_logs` joined with `profiles` on `user_id`. Apply filters. Paginate: 20 rows per page, offset by `(page - 1) * 20`.
  5. Return 200 `{ logs: [...], total: number }`.

  Each log row includes: `id`, `user_email`, `url`, `use_vision`, `created_at`, `claims` (full JSONB array), computed counts `true_count`, `false_count`, `unverifiable_count`.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/app/api/admin/
  git commit -m "feat: add admin API routes for tier management and logs"
  ```

---

## Task 10: Admin Page

**Files:**
- Create: `frontend/app/admin/page.tsx`

- [ ] **Step 1: Create `frontend/app/admin/page.tsx`**

  Server component (no `'use client'`). At the top, check session + tier server-side using `createClient` from `@/lib/supabase/server`. If not admin, return `notFound()` from `next/navigation`.

  Fetch initial data server-side:
  - All `profiles` rows (users list) via service role client.
  - First page of `api_logs` joined with emails.

  Render two sections:

  **Users Table** (client component `AdminUsersTable`):
  - Columns: email, tier (dropdown: free/pro/admin), joined date, verifications today.
  - Changing the dropdown calls `POST /api/admin/update-tier`.
  - Show success/error toast inline.

  **API Logs Table** (client component `AdminLogsTable`):
  - Columns: user email, URL (truncated), timestamp, claim count, TRUE/FALSE/UNVERIFIABLE counts.
  - Each row is expandable to show full claims with verdict + explanation + source.
  - Filter inputs: user email text field, date range (from/to).
  - Pagination: prev/next buttons.

- [ ] **Step 2: Test admin panel**

  Log in as `vanamgnaneshwar@gmail.com` and open http://localhost:3000/admin. Verify users table and logs table render correctly.

  Log out and log in as a free-tier user. Open http://localhost:3000/admin — expect 404.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/app/admin/
  git commit -m "feat: add admin panel with user tier management and log viewer"
  ```

---

## Task 11: Remove Cache from FastAPI Backend

**Files:**
- Delete: `backend/cache.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Remove `backend/cache.py`**

  ```bash
  rm backend/cache.py
  ```

- [ ] **Step 2: Update `backend/main.py`**

  Remove:
  - The `from cache import ...` import line.
  - The `force_refresh` field from the job dict (`jobs[job_id]`).
  - The `force_refresh = job["force_refresh"]` line in `event_generator`.
  - The `if force_refresh: clear_cache(...)` block.
  - The `cached = get_cached_text(...)` block and the entire cache-hit branch.
  - The `set_cached_text(...)` call.
  - The `cached_claims = get_cached_claims(...)` block and its cache-hit branch.
  - The `set_cached_claims(...)` call.
  - The `claim_results = []` list and `claim_results.append(...)` inside the loop.

  The `event_generator` should now flow straight through: download → extract → parse claims → check claims → done. No caching logic remains in FastAPI.

- [ ] **Step 3: Also update `backend/models.py`**

  Remove `force_refresh: bool = False` from `VerifyRequest`. The Next.js layer handles force_refresh (it deletes the Supabase cache row) before calling FastAPI — FastAPI no longer needs to know about it.

- [ ] **Step 4: Restart the backend and test**

  ```bash
  cd backend && uvicorn main:app --reload
  ```

  Submit a reel URL via the frontend. Confirm it still processes correctly. Confirm `extraction_cache.json` is no longer created.

- [ ] **Step 5: Commit**

  ```bash
  git add backend/main.py backend/models.py
  git rm backend/cache.py
  git commit -m "refactor: remove file-based cache from FastAPI (cache moved to Supabase)"
  ```

---

## Task 12: Vercel Deployment

**Files:**
- Create: `frontend/vercel.json` (optional — only if custom config needed)
- Modify: Vercel dashboard env vars

- [ ] **Step 1: Push frontend to GitHub**

  Ensure `frontend/` is in a Git repo (it already has `.git`). Push to GitHub if not already there.

  ```bash
  cd frontend
  git remote add origin <your GitHub repo URL>  # if not already set
  git push -u origin main
  ```

- [ ] **Step 2: Import project in Vercel**

  Go to https://vercel.com → New Project → Import the GitHub repo. Set the **Root Directory** to `frontend`.

- [ ] **Step 3: Add environment variables in Vercel dashboard**

  Under Project → Settings → Environment Variables, add:
  ```
  NEXT_PUBLIC_SUPABASE_URL        = <from Supabase dashboard>
  NEXT_PUBLIC_SUPABASE_ANON_KEY   = <from Supabase dashboard>
  SUPABASE_SERVICE_ROLE_KEY       = <from Supabase dashboard>
  BACKEND_URL                     = <Render FastAPI URL>
  NEXT_PUBLIC_BACKEND_URL         = <Render FastAPI URL>
  ```

- [ ] **Step 4: Deploy and verify**

  Trigger a deploy. Open the Vercel URL. Register an account, submit a reel URL, confirm verifications work end-to-end in production.

- [ ] **Step 5: Commit vercel.json if needed**

  Only create `frontend/vercel.json` if the deploy requires custom config (e.g., rewrites). Otherwise no file needed.

  ```bash
  git commit -m "chore: Vercel deployment configured"
  ```

---

## Self-Review

**Spec coverage:**
- ✅ Auth (login/register/logout/middleware) — Tasks 3, 4, 5
- ✅ Tiers (free/pro/admin, 5/day limit) — Task 6
- ✅ Shared Supabase cache (processed_reels, force_refresh) — Tasks 6, 7
- ✅ API logging (api_logs on done event) — Task 7
- ✅ Admin panel (users table, logs table, tier change) — Tasks 9, 10
- ✅ Remove FastAPI file cache — Task 11
- ✅ Vercel deployment — Task 12
- ✅ Seed admin (vanamgnaneshwar@gmail.com via trigger) — Task 1 (SQL)
- ✅ Edge Runtime for SSE proxy — Task 7

**No placeholders found.**

**Type consistency:** `ClaimResult` type (used in `postVerify` return and `processed_reels.claims`) must be added to `frontend/types/index.ts` as `{ text: string; verdict: 'TRUE'|'FALSE'|'UNVERIFIABLE'; explanation: string; source: string }` — this is the shape already used in `ResultEvent`. Task 8 should reuse `ResultEvent` or define `ClaimResult` as a shared type to avoid duplication.
