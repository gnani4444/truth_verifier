import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

export async function GET() {
  // 1. Auth check and admin tier verification
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("tier")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (profile.tier !== "admin") {
    return Response.json(
      { error: "Forbidden: Admin access required" },
      { status: 403 }
    );
  }

  // 2. Create service-role admin client for unrestricted queries
  const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

  if (!supabaseAdmin) {
    return Response.json(
      { error: "Service role client unavailable" },
      { status: 500 }
    );
  }

  // 3. Compute time boundaries
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const weekStart = new Date();
  weekStart.setUTCDate(weekStart.getUTCDate() - 7);
  weekStart.setUTCHours(0, 0, 0, 0);

  // 4. Run all queries in parallel
  const [
    profilesResult,
    totalLogsResult,
    logsTodayResult,
    logsWeekResult,
    allUrlsResult,
    newUsersTodayResult,
    newUsersWeekResult,
    visionResult,
  ] = await Promise.all([
    // All profiles (id + tier for counting by tier)
    supabaseAdmin.from("profiles").select("id, tier"),

    // Total verifications count
    supabaseAdmin
      .from("api_logs")
      .select("id", { count: "exact", head: true }),

    // Verifications today
    supabaseAdmin
      .from("api_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),

    // Verifications this week
    supabaseAdmin
      .from("api_logs")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString()),

    // All URLs for grouping client-side (url + distinct count)
    supabaseAdmin.from("api_logs").select("url"),

    // New users today
    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", todayStart.toISOString()),

    // New users this week
    supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .gte("created_at", weekStart.toISOString()),

    // Vision usage count
    supabaseAdmin
      .from("api_logs")
      .select("id", { count: "exact", head: true })
      .eq("use_vision", true),
  ]);

  // 5. Compute usersByTier from profiles rows
  const profiles = profilesResult.data ?? [];
  const usersByTier = { free: 0, pro: 0, admin: 0 };
  for (const p of profiles) {
    const tier = p.tier as keyof typeof usersByTier;
    if (tier in usersByTier) {
      usersByTier[tier]++;
    }
  }

  // 6. Compute topUrls and uniqueLinksVerified from all url rows
  const urlRows = allUrlsResult.data ?? [];
  const urlCounts: Record<string, number> = {};
  for (const row of urlRows) {
    if (row.url) {
      urlCounts[row.url] = (urlCounts[row.url] ?? 0) + 1;
    }
  }
  const uniqueLinksVerified = Object.keys(urlCounts).length;
  const topUrls = Object.entries(urlCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([url, count]) => ({ url, count }));

  // 7. Build and return response
  return Response.json({
    totalUsers: profiles.length,
    usersByTier,
    totalVerifications: totalLogsResult.count ?? 0,
    verificationsToday: logsTodayResult.count ?? 0,
    verificationsThisWeek: logsWeekResult.count ?? 0,
    uniqueLinksVerified,
    topUrls,
    newUsersToday: newUsersTodayResult.count ?? 0,
    newUsersThisWeek: newUsersWeekResult.count ?? 0,
    visionUsageCount: visionResult.count ?? 0,
  });
}
