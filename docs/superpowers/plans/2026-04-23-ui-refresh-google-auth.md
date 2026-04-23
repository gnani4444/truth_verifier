# Truth Verifier UI Refresh + Google Sign-In Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the landing page UI, add a profile section with usage tracking, an upgrade-to-pro contact flow, and Google OAuth sign-in via Supabase.

**Architecture:** Next.js 16 App Router. New shared components (Navbar, UsageBanner, UpgradeModal, ProfileClient) live in `frontend/components/`. A new `/profile` route is a server component that fetches data then passes it to a client sub-component. Google OAuth adds one new route handler (`/auth/callback`) and requires one manual Supabase + Google Cloud Console setup step documented in Task 1. The `handle_new_user` Postgres trigger is created/fixed so every signup (email or OAuth) auto-creates a `profiles` row.

**Tech Stack:** Next.js 16, TypeScript, Tailwind CSS, `@supabase/ssr ^0.10.2`, `@supabase/supabase-js ^2.104.0`, Supabase Auth OAuth (Google provider)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/app/auth/callback/route.ts` | Create | Exchange OAuth code for session, redirect to app |
| `frontend/proxy.ts` | Modify | Add `/auth/callback` to PUBLIC_ROUTES |
| `frontend/components/Navbar.tsx` | Create | Shared top nav: logo, tier badge, profile link, sign-out |
| `frontend/components/UsageBanner.tsx` | Create | Free-tier usage progress bar + upgrade CTA |
| `frontend/components/UpgradeModal.tsx` | Create | Modal: "contact admin" mailto link |
| `frontend/components/ProfileClient.tsx` | Create | Client component rendering profile page UI |
| `frontend/app/profile/page.tsx` | Create | Server component: fetch profile + usage, pass to ProfileClient |
| `frontend/app/api/profile/usage/route.ts` | Create | API: return { used, limit, tier } for current user |
| `frontend/app/page.tsx` | Modify | Hero section, Navbar, UsageBanner for free users |
| `frontend/app/login/page.tsx` | Modify | Add Google sign-in button |
| `frontend/app/register/page.tsx` | Modify | Add Google sign-up button |

---

## Task 1: OAuth Callback Route + handle_new_user Trigger + RLS

**Files:**
- Create: `frontend/app/auth/callback/route.ts`
- Modify: `frontend/proxy.ts` (add `/auth/callback` to PUBLIC_ROUTES)
- No test file — test manually by running the OAuth flow

- [ ] **Step 1: Run the following SQL in the Supabase SQL Editor to fix the `handle_new_user` trigger and ensure the RLS SELECT policy exists**

```sql
-- Auto-create a profiles row on every new signup (email or OAuth)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, tier)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', ''),
    'free'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Allow users to read their own profile row
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles' AND policyname = 'Users can read own profile'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can read own profile" ON profiles FOR SELECT USING (auth.uid() = id)';
  END IF;
END$$;
```

- [ ] **Step 2: Enable Google OAuth in Supabase (manual dashboard step)**

```
1. Supabase dashboard → Authentication → Providers → Google → Enable
2. Copy the "Callback URL" shown (looks like https://<project>.supabase.co/auth/v1/callback)
3. Google Cloud Console → APIs & Services → Credentials → Create OAuth 2.0 Client ID
   - Application type: Web application
   - Authorized redirect URIs: paste the Supabase Callback URL from step 2
4. Copy the Client ID and Client Secret back into Supabase → Google provider → Save
5. Supabase dashboard → Authentication → URL Configuration:
   - Add Site URL: http://localhost:3000 (for local dev)
   - Add Redirect URL: http://localhost:3000/auth/callback
```

- [ ] **Step 3: Create `frontend/app/auth/callback/route.ts`**

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
```

- [ ] **Step 4: Add `/auth/callback` to PUBLIC_ROUTES in `frontend/proxy.ts`**

In `frontend/proxy.ts`, change:
```ts
const PUBLIC_ROUTES = ["/login", "/register"];
```
to:
```ts
const PUBLIC_ROUTES = ["/login", "/register", "/auth/callback"];
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/auth/callback/route.ts frontend/proxy.ts
git commit -m "feat: add OAuth callback route and fix handle_new_user trigger"
```

---

## Task 2: Shared Navbar Component

**Files:**
- Create: `frontend/components/Navbar.tsx`

- [ ] **Step 1: Create `frontend/components/Navbar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  email: string | null;
  tier: string | null;
}

export default function Navbar({ email, tier }: NavbarProps) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const tierColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    pro: "bg-green-100 text-green-700",
    free: "bg-gray-100 text-gray-600",
  };
  const tierClass = tier ? (tierColors[tier] ?? "bg-gray-100 text-gray-600") : "";

  return (
    <nav className="flex items-center justify-between py-4 px-6 bg-white border-b border-gray-100 shadow-sm">
      <Link href="/" className="text-lg font-bold text-gray-900 tracking-tight">
        Truth Verifier
      </Link>

      <div className="flex items-center gap-4">
        {tier && (
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tierClass}`}>
            {tier.toUpperCase()}
          </span>
        )}
        {email && (
          <Link
            href="/profile"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            {email}
          </Link>
        )}
        <button
          onClick={handleSignOut}
          className="px-3 py-1.5 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/Navbar.tsx
git commit -m "feat: add shared Navbar component"
```

---

## Task 3: UsageBanner + UpgradeModal Components

**Files:**
- Create: `frontend/components/UsageBanner.tsx`
- Create: `frontend/components/UpgradeModal.tsx`

- [ ] **Step 1: Create `frontend/components/UsageBanner.tsx`**

```tsx
interface UsageBannerProps {
  used: number;
  limit: number;
  onUpgrade: () => void;
}

export default function UsageBanner({ used, limit, onUpgrade }: UsageBannerProps) {
  const remaining = Math.max(0, limit - used);
  const pct = Math.min(100, (used / limit) * 100);
  const isExhausted = remaining === 0;

  return (
    <div
      className={`rounded-xl p-4 ${
        isExhausted
          ? "bg-red-50 border border-red-200"
          : "bg-blue-50 border border-blue-100"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-700">
          {isExhausted
            ? "Daily limit reached — 0 verifications remaining"
            : `${remaining} of ${limit} free verifications remaining today`}
        </span>
        <button
          onClick={onUpgrade}
          className="text-xs font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          Upgrade to Pro →
        </button>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            isExhausted ? "bg-red-500" : "bg-blue-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `frontend/components/UpgradeModal.tsx`**

The admin email (`vanamgnaneshwar@gmail.com`) is hardcoded here intentionally — this is the single contact point for upgrades.

```tsx
"use client";

interface UpgradeModalProps {
  onClose: () => void;
}

export default function UpgradeModal({ onClose }: UpgradeModalProps) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl p-8 max-w-sm w-full"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="text-center mb-6">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-6 h-6 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Upgrade to Pro</h2>
          <p className="text-gray-500 text-sm">
            Get unlimited daily verifications and priority processing. Contact the
            admin to upgrade your account.
          </p>
        </div>

        <div className="space-y-3">
          <a
            href="mailto:vanamgnaneshwar@gmail.com?subject=Truth%20Verifier%20Pro%20Upgrade%20Request"
            className="flex items-center justify-center w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Contact Admin to Upgrade
          </a>
          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 text-gray-500 text-sm font-medium hover:text-gray-700 transition-colors"
          >
            Maybe later
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/components/UsageBanner.tsx frontend/components/UpgradeModal.tsx
git commit -m "feat: add UsageBanner and UpgradeModal components"
```

---

## Task 4: Usage API Route + Profile Page

**Files:**
- Create: `frontend/app/api/profile/usage/route.ts`
- Create: `frontend/app/profile/page.tsx`
- Create: `frontend/components/ProfileClient.tsx`

- [ ] **Step 1: Create `frontend/app/api/profile/usage/route.ts`**

```ts
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (!profile) {
    return Response.json({ error: "Profile not found" }, { status: 404 });
  }

  if (profile.tier !== "free") {
    return Response.json({ used: 0, limit: null, tier: profile.tier });
  }

  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);

  const { count } = await supabase
    .from("api_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", todayUTC.toISOString());

  return Response.json({ used: count ?? 0, limit: 5, tier: profile.tier });
}
```

- [ ] **Step 2: Create `frontend/components/ProfileClient.tsx`**

```tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import UsageBanner from "@/components/UsageBanner";
import UpgradeModal from "@/components/UpgradeModal";

interface ProfileClientProps {
  email: string;
  tier: string;
  memberSince: string;
  used: number;
  limit: number | null;
}

export default function ProfileClient({
  email,
  tier,
  memberSince,
  used,
  limit,
}: ProfileClientProps) {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const tierColors: Record<string, string> = {
    admin: "bg-purple-100 text-purple-700",
    pro: "bg-green-100 text-green-700",
    free: "bg-gray-100 text-gray-600",
  };
  const tierClass = tierColors[tier] ?? "bg-gray-100 text-gray-600";

  return (
    <main className="min-h-screen bg-gray-50">
      <nav className="flex items-center justify-between py-4 px-6 bg-white border-b border-gray-100 shadow-sm">
        <Link href="/" className="text-lg font-bold text-gray-900">
          Truth Verifier
        </Link>
        <span className="text-sm text-gray-500">Profile</span>
      </nav>

      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <div className="bg-white rounded-xl shadow-sm p-6">
          <h1 className="text-xl font-bold text-gray-900 mb-6">Your Profile</h1>

          <div className="divide-y divide-gray-100">
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Email</span>
              <span className="text-sm font-medium text-gray-900">{email}</span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Plan</span>
              <span
                className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${tierClass}`}
              >
                {tier.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between py-3">
              <span className="text-sm text-gray-500">Member since</span>
              <span className="text-sm text-gray-900">{memberSince}</span>
            </div>
          </div>
        </div>

        {tier === "free" && limit !== null && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 mb-4">
              Today&apos;s Usage
            </h2>
            <UsageBanner
              used={used}
              limit={limit}
              onUpgrade={() => setShowUpgrade(true)}
            />
          </div>
        )}

        {tier === "free" && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
            <h2 className="text-base font-bold text-gray-900 mb-1">
              Upgrade to Pro
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              Unlimited verifications per day, no daily caps.
            </p>
            <button
              onClick={() => setShowUpgrade(true)}
              className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Contact Admin to Upgrade
            </button>
          </div>
        )}
      </div>

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </main>
  );
}
```

- [ ] **Step 3: Create `frontend/app/profile/page.tsx`**

```tsx
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import ProfileClient from "@/components/ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("tier, email")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");

  let used = 0;
  if (profile.tier === "free") {
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("api_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayUTC.toISOString());
    used = count ?? 0;
  }

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <ProfileClient
      email={user.email ?? profile.email ?? ""}
      tier={profile.tier}
      memberSince={memberSince}
      used={used}
      limit={profile.tier === "free" ? 5 : null}
    />
  );
}
```

- [ ] **Step 4: Verify the profile page renders correctly**

```bash
# With the dev server running at http://localhost:3000, open:
# http://localhost:3000/profile
# Expected: Profile page with email, tier badge, member since date.
# For free tier: usage bar visible. For admin/pro: no usage section.
```

- [ ] **Step 5: Commit**

```bash
git add frontend/app/api/profile/usage/route.ts \
        frontend/app/profile/page.tsx \
        frontend/components/ProfileClient.tsx
git commit -m "feat: add profile page and usage API"
```

---

## Task 5: Revamped Landing Page

**Files:**
- Modify: `frontend/app/page.tsx`

The page keeps all existing verify logic. Changes: replace the minimal header with `Navbar`, add a hero section, add `UsageBanner` for free users, and use `UpgradeModal` when the daily limit is hit.

- [ ] **Step 1: Replace `frontend/app/page.tsx` with the revamped version**

```tsx
"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import UrlInput from "@/components/UrlInput";
import MediaPreview from "@/components/MediaPreview";
import ClaimsList from "@/components/ClaimsList";
import Navbar from "@/components/Navbar";
import UsageBanner from "@/components/UsageBanner";
import UpgradeModal from "@/components/UpgradeModal";
import { postVerify, getMediaUrl, streamResults } from "@/lib/api";
import type { ClaimResult } from "@/lib/api";
import type { ClaimState, SseEvent } from "@/types";
import { createClient } from "@/lib/supabase/client";

interface UsageInfo {
  used: number;
  limit: number | null;
  tier: string | null;
}

export default function Home() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [usage, setUsage] = useState<UsageInfo>({ used: 0, limit: null, tier: null });
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [visionRequired, setVisionRequired] = useState(false);
  const [lastUrl, setLastUrl] = useState("");
  const [lastUseVision, setLastUseVision] = useState(false);
  const [mediaType, setMediaType] = useState<"video" | "image" | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [claims, setClaims] = useState<ClaimState[]>([]);
  const [extractedText, setExtractedText] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? null);
    });

    fetch("/api/profile/usage")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setUsage({ used: d.used, limit: d.limit, tier: d.tier });
        }
      })
      .catch(() => {});
  }, []);

  const refreshUsage = useCallback(() => {
    fetch("/api/profile/usage")
      .then((r) => r.json())
      .then((d) => {
        if (!d.error) {
          setUsage({ used: d.used, limit: d.limit, tier: d.tier });
        }
      })
      .catch(() => {});
  }, []);

  const handleVerify = useCallback(
    async (url: string, useVision: boolean, forceRefresh: boolean = false) => {
      setLoading(true);
      setError("");
      setVisionRequired(false);
      setLastUrl(url);
      setLastUseVision(useVision);
      setStatus("Connecting to server...");
      setClaims([]);
      setExtractedText(null);
      setMediaUrl(null);
      setMediaType(null);
      setDownloadUrl(null);

      let cleanup: (() => void) | null = null;

      try {
        const { jobId, claims: cachedClaims, extractedText: cachedText } =
          await postVerify(url, useVision, forceRefresh);

        if (cachedClaims !== null) {
          const doneStates: ClaimState[] = cachedClaims.map((c: ClaimResult) => ({
            text: c.text,
            status: "done",
            verdict: c.verdict,
            explanation: c.explanation,
            source: c.source,
          }));
          setClaims(doneStates);
          if (cachedText !== null) setExtractedText(cachedText);
          setStatus("");
          setLoading(false);
          refreshUsage();
          return;
        }

        if (jobId !== null) {
          cleanup = streamResults(
            jobId,
            url,
            useVision,
            (event: SseEvent) => {
              if (event.type === "status") {
                setStatus(event.message);
              } else if (event.type === "media") {
                const mediaUrlValue = getMediaUrl(jobId);
                setMediaUrl(mediaUrlValue);
                setDownloadUrl(mediaUrlValue);
                setMediaType(event.media_type);
              } else if (event.type === "text") {
                setExtractedText(event.content);
              } else if (event.type === "claim") {
                setClaims((prev) => [...prev, { text: event.text, status: "checking" }]);
              } else if (event.type === "result") {
                setClaims((prev) =>
                  prev.map((c) =>
                    c.text === event.text
                      ? {
                          text: event.text,
                          status: "done",
                          verdict: event.verdict,
                          explanation: event.explanation,
                          source: event.source,
                        }
                      : c
                  )
                );
              } else if (event.type === "done") {
                setStatus("");
                setLoading(false);
                cleanup?.();
                refreshUsage();
              } else if (event.type === "error") {
                setError(event.message);
                setVisionRequired(event.vision_required === true);
                setStatus("");
                setLoading(false);
                cleanup?.();
              }
            },
            (err) => {
              setError(err.message);
              setStatus("");
              setLoading(false);
            }
          );
        }
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "Failed to connect to server. Is it running?";
        if (msg.toLowerCase().includes("daily limit")) {
          setShowUpgrade(true);
        }
        setError(msg);
        setStatus("");
        setLoading(false);
      }
    },
    [refreshUsage]
  );

  const hasResults = extractedText !== null || claims.length > 0;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar email={userEmail} tier={usage.tier} />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-3xl mx-auto px-6 py-14 text-center">
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight mb-3">
              Fact-check Instagram in seconds
            </h1>
            <p className="text-gray-500 text-lg max-w-xl mx-auto">
              Paste a public Instagram post or reel URL. Truth Verifier extracts
              every claim and cross-references it against trusted sources.
            </p>
          </div>
        </section>

        <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
          {/* Usage banner for free users */}
          {usage.tier === "free" && usage.limit !== null && (
            <UsageBanner
              used={usage.used}
              limit={usage.limit}
              onUpgrade={() => setShowUpgrade(true)}
            />
          )}

          {/* URL input */}
          <div className="bg-white rounded-xl shadow-sm p-4 flex items-end gap-3">
            <div className="flex-1">
              <UrlInput onVerify={handleVerify} loading={loading} />
            </div>
            {hasResults && !loading && (
              <button
                onClick={() => handleVerify(lastUrl, lastUseVision, true)}
                className="shrink-0 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors border border-gray-200"
                title="Clear cache and re-run from scratch"
              >
                ↺ Refresh
              </button>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between gap-4">
              <span>{error}</span>
              {visionRequired && (
                <button
                  onClick={() => handleVerify(lastUrl, true)}
                  className="shrink-0 px-3 py-1 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  Retry with Visual Analysis
                </button>
              )}
            </div>
          )}

          {/* Extracted text */}
          {extractedText && (
            <details className="bg-white rounded-xl shadow-sm p-4">
              <summary className="text-base font-semibold text-gray-800 cursor-pointer select-none">
                Extracted Text
              </summary>
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                {extractedText}
              </p>
            </details>
          )}

          {/* Results grid */}
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

      {showUpgrade && <UpgradeModal onClose={() => setShowUpgrade(false)} />}
    </div>
  );
}
```

- [ ] **Step 2: Start the dev server and verify the landing page**

```bash
# http://localhost:3000 should show:
# - Navbar with email, tier badge, sign-out button
# - Hero section with headline and subtitle
# - Usage banner (only if free tier)
# - URL input card below
# - Results grid appears after a verify run
```

- [ ] **Step 3: Commit**

```bash
git add frontend/app/page.tsx
git commit -m "feat: revamp landing page with hero section and usage banner"
```

---

## Task 6: Google Sign-In on Login and Register Pages

**Files:**
- Modify: `frontend/app/login/page.tsx`
- Modify: `frontend/app/register/page.tsx`

Both pages get a "Continue with Google" button above the email/password form with a divider between them.

- [ ] **Step 1: Replace `frontend/app/login/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Sign In</h1>
            <p className="text-gray-500 text-sm mt-1">
              Access Truth Verifier
            </p>
          </div>

          {/* Google sign-in */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading || googleLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading || googleLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{" "}
              <Link
                href="/register"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Replace `frontend/app/register/page.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function RegisterPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-white rounded-xl shadow-sm p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
            <p className="text-gray-500 text-sm mt-1">
              Start fact-checking with Truth Verifier
            </p>
          </div>

          {/* Google sign-up */}
          <button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading || loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mb-6"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {googleLoading ? "Redirecting..." : "Continue with Google"}
          </button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-white text-gray-400">or sign up with email</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                disabled={loading || googleLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading || googleLoading}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || googleLoading}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg font-medium text-sm hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-600">
              Already have an account?{" "}
              <Link
                href="/login"
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
```

- [ ] **Step 3: Verify Google sign-in flow in browser**

```
1. Go to http://localhost:3000/login
2. Click "Continue with Google"
3. Expected: Google OAuth consent screen opens
4. After authorizing, should land on http://localhost:3000/ (the callback redirects there)
5. Navbar should show your Google account email
6. http://localhost:3000/api/debug should show auth: "logged in" with a profile row
```

- [ ] **Step 4: Commit**

```bash
git add frontend/app/login/page.tsx frontend/app/register/page.tsx
git commit -m "feat: add Google OAuth sign-in to login and register pages"
```

---

## Also: Remove Debug Artifacts

After the Unauthorized bug is confirmed fixed, remove the debug endpoint created during diagnosis.

- [ ] **Delete `frontend/app/api/debug/route.ts`**

```bash
git rm frontend/app/api/debug/route.ts
git commit -m "chore: remove debug endpoint"
```
