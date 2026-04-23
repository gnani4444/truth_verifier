# Auth, Tiers & Logging — Design Spec

**Date:** 2026-04-22

## Goal

Add user authentication, tier-based access control, shared URL caching, and detailed API logging to the Truth Verifier app. The Next.js frontend moves from Render to Vercel. The Python FastAPI backend stays on Render unchanged.

---

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend + API routes | Next.js (TypeScript, Tailwind) on **Vercel** (free) |
| Auth | Supabase Auth (email/password) |
| Database | Supabase Postgres |
| ORM / DB client | `@supabase/ssr` + `@supabase/supabase-js` |
| Processing backend | Python FastAPI on **Render** (unchanged) |

---

## Architecture

```
Browser
  │
  ▼
Next.js on Vercel
  │
  ├── /login                    ← Supabase Auth email/password
  ├── /register                 ← Supabase Auth sign-up
  ├── / (main page)             ← protected, requires session
  ├── /admin                    ← protected, requires tier = 'admin'
  │
  ├── middleware.ts
  │     ├── Unauthenticated → redirect to /login
  │     ├── /admin → check tier = 'admin', else 404
  │     └── Refresh session cookies via @supabase/ssr
  │
  ├── /api/verify (Next.js API route)
  │     ├── 1. Validate session (401 if missing)
  │     ├── 2. Fetch profile → check tier
  │     │       Free: count today's api_logs rows ≥ 5 → 429
  │     │       Pro / Admin: no limit
  │     ├── 3. Check processed_reels cache (url + use_vision)
  │     │       HIT  → stream cached claims, insert api_logs row → done
  │     │       MISS → continue
  │     ├── 4. POST /verify to FastAPI on Render → get job_id
  │     ├── 5. Proxy GET /verify/stream/{job_id} SSE back to browser
  │     └── 6. On SSE 'done': upsert processed_reels, insert api_logs
  │
  ├── /api/admin/update-tier    ← admin only, updates profiles.tier
  └── /api/admin/logs           ← admin only, returns paginated api_logs
  │
  └── Supabase (hosted, free tier)
        ├── auth.users           ← managed by Supabase
        ├── profiles             ← tier, created_at
        ├── processed_reels      ← shared URL cache
        └── api_logs             ← per-user detailed logs
```

---

## Database Schema

```sql
-- Auto-managed by Supabase Auth
-- auth.users (id uuid, email text, ...)

-- Extended user profile
CREATE TABLE profiles (
  id         uuid PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email      text NOT NULL,
  tier       text NOT NULL DEFAULT 'free',  -- 'free' | 'pro' | 'admin'
  created_at timestamptz DEFAULT now()
);

-- Trigger: auto-create profile on sign-up
-- vanamgnaneshwar@gmail.com is seeded as admin (see Seed Data section)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
DECLARE
  user_tier text := 'free';
BEGIN
  IF new.email = 'vanamgnaneshwar@gmail.com' THEN
    user_tier := 'admin';
  END IF;
  INSERT INTO public.profiles (id, email, tier)
  VALUES (new.id, new.email, user_tier);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Shared cache: one row per unique URL + vision combo
CREATE TABLE processed_reels (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  url            text NOT NULL,
  use_vision     boolean NOT NULL DEFAULT false,
  extracted_text text,
  claims         jsonb,  -- [{text, verdict, explanation, source}]
  created_at     timestamptz DEFAULT now(),
  UNIQUE(url, use_vision)
);

-- Per-user detailed log of every verification
CREATE TABLE api_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  url        text NOT NULL,
  use_vision boolean NOT NULL DEFAULT false,
  claims     jsonb,  -- [{text, verdict, explanation, source}]
  created_at timestamptz DEFAULT now()
);

-- Index for daily limit check
CREATE INDEX idx_api_logs_user_date ON api_logs (user_id, created_at);
```

---

## Auth Flow

### Registration (`/register`)
1. User submits email + password
2. `supabase.auth.signUp({ email, password })` called client-side
3. Supabase creates `auth.users` row; trigger creates `profiles` row (tier: `'free'`)
4. User redirected to `/`

### Login (`/login`)
1. User submits email + password
2. `supabase.auth.signInWithPassword({ email, password })` called client-side
3. Session stored in cookies via `@supabase/ssr`
4. User redirected to `/`

### Session Management
- `middleware.ts` runs on every request
- Uses `createServerClient` from `@supabase/ssr` to read + refresh session from cookies
- Unauthenticated requests to protected routes → redirect to `/login`
- `/admin` route → reads `profiles.tier`; non-admin → 404

### Logout
- `supabase.auth.signOut()` called client-side
- Cookies cleared; user redirected to `/login`

---

## Tier Enforcement

| Tier | Daily limit | Admin panel access |
|------|------------|-------------------|
| free | 5 verifications/day | No |
| pro  | Unlimited | No |
| admin | Unlimited | Yes |

**Enforcement in `/api/verify`:**
```
SELECT COUNT(*) FROM api_logs
WHERE user_id = $1
  AND created_at >= DATE_TRUNC('day', NOW())
```
If count ≥ 5 and tier = 'free' → return 429 with message "Daily limit reached (5/day). Upgrade to Pro for unlimited access."

---

## Shared Cache

The existing `extraction_cache.json` file on the FastAPI backend is **removed**. `processed_reels` in Supabase becomes the single cache.

- **Cache hit**: `/api/verify` reads `processed_reels` where `url = $1 AND use_vision = $2`, streams claims directly to browser, logs to `api_logs`.
- **Cache miss**: Full pipeline runs via FastAPI; on `done` event, upserts into `processed_reels`.
- **Force refresh** (`force_refresh: true`): Deletes the `processed_reels` row for that URL + vision combo before running the pipeline.

---

## API Logging

Every completed verification inserts one row into `api_logs`:
```json
{
  "user_id": "uuid",
  "url": "https://instagram.com/reel/...",
  "use_vision": false,
  "claims": [
    {
      "text": "Fenugreek improves digestion",
      "verdict": "TRUE",
      "explanation": "Multiple studies support...",
      "source": "https://healthline.com/..."
    }
  ]
}
```

Logs are written after the full SSE stream completes (on `done` event). If the stream errors, no log row is written.

---

## Admin Panel (`/admin`)

Server-rendered Next.js page. Only accessible when `profiles.tier = 'admin'`.

### Users Table
- Columns: email, tier, joined date, verifications today
- Action: dropdown to change tier (`free` → `pro` → `admin`)
- Calls `POST /api/admin/update-tier` with `{ userId, tier }`

### API Logs Table
- Columns: user email, URL, timestamp, claim count, TRUE / FALSE / UNVERIFIABLE counts
- Filterable by user email, date range
- Expandable row → shows each claim with verdict + explanation + source

### Admin API Routes
- `POST /api/admin/update-tier` — uses Supabase service role key (server-side only)
- `GET /api/admin/logs?page=1&user=&from=&to=` — paginated, filterable

---

## File Changes

### New files
```
frontend/
  app/
    login/page.tsx           ← email/password login form
    register/page.tsx        ← sign-up form
    admin/page.tsx           ← admin panel (users + logs)
  lib/
    supabase/
      client.ts              ← browser Supabase client
      server.ts              ← server-side Supabase client (@supabase/ssr)
  middleware.ts              ← session guard + /admin tier check
  app/api/
    verify/route.ts          ← replaces direct FastAPI call; adds auth + cache + logging
    admin/
      update-tier/route.ts   ← admin tier change
      logs/route.ts          ← admin log fetch
```

### Modified files
```
frontend/
  app/page.tsx               ← wrap in auth check; reads session
  lib/api.ts                 ← calls /api/verify (Next.js route) instead of FastAPI directly
  package.json               ← add @supabase/ssr, @supabase/supabase-js
backend/
  cache.py                   ← DELETE (cache moves to Supabase)
  main.py                    ← remove cache import/usage; remove force_refresh logic
```

---

## Environment Variables

### Vercel (frontend)
```
NEXT_PUBLIC_SUPABASE_URL        # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY   # Supabase anon key (safe to expose)
SUPABASE_SERVICE_ROLE_KEY       # Service role key (server-side only, never exposed)
BACKEND_URL                     # FastAPI Render URL (e.g. https://truth-verifier.onrender.com)
```

### Render (backend — unchanged)
```
GRADIUM_API_KEY
TINYFISH_API_KEY
GEMINI_API_KEY
```

---

## Seed Data

`vanamgnaneshwar@gmail.com` is the initial admin. The sign-up trigger automatically assigns `tier = 'admin'` when this email registers. No manual SQL update needed after first sign-up.

If the account needs to be promoted after the fact (e.g., registered before the trigger was in place):
```sql
UPDATE profiles SET tier = 'admin' WHERE email = 'vanamgnaneshwar@gmail.com';
```

---

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Not logged in | Redirect to /login |
| Free user hits daily limit | 429 — "Daily limit reached (5/day)" |
| Non-admin accesses /admin | 404 |
| Supabase unreachable | 503 — "Service temporarily unavailable" |
| FastAPI backend down | SSE error event — "Could not connect to processing server" |
| Cache write fails | Log warning server-side; do not block user response |

---

## Constraints

- Supabase free tier: 500MB DB, 2GB bandwidth, pauses after **1 week of inactivity** — acceptable for development/demo
- Vercel free tier: 10s serverless timeout — the `/api/verify` route proxies an SSE stream using `new Response(ReadableStream)` with `runtime = 'edge'` (Edge Runtime has no timeout limit on Vercel free tier); do NOT use standard Node.js serverless runtime for this route
- No payment integration in this phase — tier changes are admin-only manual actions
