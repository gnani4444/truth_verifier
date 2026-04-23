import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function POST(req: Request) {
  // 1. Parse body
  const { url, use_vision = false, force_refresh = false } = await req.json();

  // 2. Auth check
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseAdmin =
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            cookies: {
              getAll() {
                return [];
              },
              setAll() {},
            },
          }
        )
      : null;

  // 3. Fetch profile tier
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 4. Free tier daily limit check
  if (profile.tier === "free") {
    const todayUTC = new Date();
    todayUTC.setUTCHours(0, 0, 0, 0);

    const { count, error: countError } = await supabase
      .from("api_logs")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", todayUTC.toISOString());

    if (countError) {
      return Response.json({ error: "Rate limit check failed" }, { status: 429 });
    }

    if ((count ?? 0) >= 5) {
      return Response.json(
        {
          error:
            "Daily limit reached (5/day). Upgrade to Pro for unlimited access.",
        },
        { status: 429 }
      );
    }
  }

  // 5. Force refresh: delete cached row
  if (force_refresh === true) {
    const deleter = supabaseAdmin ?? supabase;
    await deleter.from("processed_reels").delete().eq("url", url).eq("use_vision", use_vision);
  }

  // 6. Cache lookup
  // Use service role for cache reads so we can reuse processed results across all users
  // even when RLS blocks anon reads.
  const cacheReader = supabaseAdmin ?? supabase;
  const { data: cached } = await cacheReader
    .from("processed_reels")
    .select("claims, extracted_text")
    .eq("url", url)
    .eq("use_vision", use_vision)
    .single();

  if (cached) {
    const logger = supabaseAdmin ?? supabase;
    const { error: logError } = await logger.from("api_logs").insert({
      user_id: user.id,
      url,
      use_vision,
      claims: cached.claims,
    });

    if (logError) {
      console.error("api_logs insert failed (cache hit):", logError);
    }

    return Response.json({
      job_id: null,
      claims: cached.claims,
      extracted_text: cached.extracted_text,
    });
  }

  // 7. Forward to FastAPI backend
  let data: { job_id: string };
  try {
    const backendRes = await fetch(`${BACKEND_URL}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, use_vision }),
    });

    if (!backendRes.ok) {
      return Response.json(
        { error: "Processing server unavailable" },
        { status: 502 }
      );
    }

    data = await backendRes.json();
  } catch {
    return Response.json(
      { error: "Processing server unavailable" },
      { status: 502 }
    );
  }

  // 8. Return job_id for polling
  return Response.json({ job_id: data.job_id, claims: null });
}
