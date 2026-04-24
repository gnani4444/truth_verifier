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

  const now = new Date();

  const todayUTC = new Date(now);
  todayUTC.setUTCHours(0, 0, 0, 0);

  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setUTCDate(sevenDaysAgo.getUTCDate() - 6);
  sevenDaysAgo.setUTCHours(0, 0, 0, 0);

  const [{ count: total }, { count: today }, { count: week }, { data: logs }] =
    await Promise.all([
      reader
        .from("api_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id),
      reader
        .from("api_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", todayUTC.toISOString()),
      reader
        .from("api_logs")
        .select("*", { count: "exact", head: true })
        .eq("user_id", user.id)
        .gte("created_at", sevenDaysAgo.toISOString()),
      reader
        .from("api_logs")
        .select("claims, created_at")
        .eq("user_id", user.id)
        .gte("created_at", sevenDaysAgo.toISOString())
        .order("created_at", { ascending: true }),
    ]);

  const verdicts = { TRUE: 0, FALSE: 0, UNVERIFIABLE: 0 };
  const daily: Record<string, number> = {};

  for (let i = 0; i < 7; i++) {
    const d = new Date(sevenDaysAgo);
    d.setUTCDate(d.getUTCDate() + i);
    daily[d.toISOString().split("T")[0]] = 0;
  }

  for (const log of logs ?? []) {
    const dateStr = (log.created_at as string).split("T")[0];
    if (dateStr in daily) daily[dateStr]++;

    if (Array.isArray(log.claims)) {
      for (const claim of log.claims as { verdict?: string }[]) {
        if (claim.verdict === "TRUE") verdicts.TRUE++;
        else if (claim.verdict === "FALSE") verdicts.FALSE++;
        else if (claim.verdict === "UNVERIFIABLE") verdicts.UNVERIFIABLE++;
      }
    }
  }

  return Response.json({
    total: total ?? 0,
    today: today ?? 0,
    week: week ?? 0,
    verdicts,
    daily,
  });
}
