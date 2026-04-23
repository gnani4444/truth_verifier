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
