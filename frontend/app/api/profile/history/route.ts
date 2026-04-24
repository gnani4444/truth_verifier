import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin =
    process.env.SUPABASE_SERVICE_ROLE_KEY
      ? createServerClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY,
          {
            cookies: {
              getAll() { return []; },
              setAll() {},
            },
          }
        )
      : null;

  const reader = supabaseAdmin ?? supabase;

  const { data: logs } = await reader
    .from("api_logs")
    .select("id, url, use_vision, claims, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(20);

  const history = (logs ?? []).map((log) => {
    const claims = Array.isArray(log.claims)
      ? (log.claims as { verdict?: string }[])
      : [];
    const verdicts = claims.reduce<Record<string, number>>((acc, c) => {
      if (c.verdict) acc[c.verdict] = (acc[c.verdict] ?? 0) + 1;
      return acc;
    }, {});
    return {
      id: log.id as string,
      url: log.url as string,
      use_vision: log.use_vision as boolean,
      created_at: log.created_at as string,
      claim_count: claims.length,
      verdicts,
    };
  });

  return Response.json({ history });
}
