import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdmin } from "@supabase/supabase-js";

interface Claim {
  claim: string;
  verdict: "TRUE" | "FALSE" | "UNVERIFIABLE";
  [key: string]: unknown;
}

interface ApiLog {
  id: string;
  user_id: string;
  url: string;
  use_vision: boolean;
  claims: Claim[] | null;
  created_at: string;
  user_email?: string;
  true_count?: number;
  false_count?: number;
  unverifiable_count?: number;
}

export async function GET(req: Request) {
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

  // 2. Create service role client for all data queries (bypasses RLS)
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createSupabaseAdmin(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY
      )
    : null;

  if (!serviceRole) {
    return Response.json({ error: "Server configuration error" }, { status: 500 });
  }

  // 3. Parse query parameters
  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") || "1";
  const userEmailFilter = url.searchParams.get("user");
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // 4. Build query using service role client (no join — fetch emails separately)
  let query = serviceRole
    .from("api_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });

  // Apply date filters
  if (fromDate) {
    query = query.gte("created_at", fromDate);
  }

  if (toDate) {
    query = query.lte("created_at", toDate);
  }

  // Apply pagination after filters
  query = query.range(offset, offset + pageSize - 1);

  const { data: logs, count, error: logsError } = await query;

  if (logsError) {
    console.error("Logs query failed:", logsError);
    return Response.json({ error: "Failed to fetch logs" }, { status: 500 });
  }

  // 5. Fetch emails for all unique user_ids in one query
  const userIds = [...new Set((logs || []).map((log: any) => log.user_id).filter(Boolean))];
  const emailMap: Record<string, string> = {};

  if (userIds.length > 0) {
    const { data: profileRows, error: profilesError } = await serviceRole
      .from("profiles")
      .select("id, email")
      .in("id", userIds);

    if (profilesError) {
      console.error("Profiles fetch failed:", profilesError);
    } else {
      (profileRows || []).forEach((p: any) => {
        emailMap[p.id] = p.email;
      });
    }
  }

  // Apply email filter in memory (after email lookup)
  const filteredLogs = userEmailFilter
    ? (logs || []).filter((log: any) =>
        (emailMap[log.user_id] || "").toLowerCase().includes(userEmailFilter.toLowerCase())
      )
    : logs || [];

  // 6. Process results: attach emails and compute verdict counts
  const processedLogs = filteredLogs.map((log: any) => {
    const email = emailMap[log.user_id] || "unknown";

    // Compute verdict counts from claims array
    let true_count = 0;
    let false_count = 0;
    let unverifiable_count = 0;

    if (Array.isArray(log.claims)) {
      log.claims.forEach((claim: Claim) => {
        if (claim.verdict === "TRUE") true_count++;
        else if (claim.verdict === "FALSE") false_count++;
        else if (claim.verdict === "UNVERIFIABLE") unverifiable_count++;
      });
    }

    return {
      id: log.id,
      user_email: email,
      url: log.url,
      use_vision: log.use_vision,
      created_at: log.created_at,
      claims: log.claims,
      true_count,
      false_count,
      unverifiable_count,
    };
  });

  // 7. Return paginated results
  // When an email filter is active, total reflects filtered count (in-memory);
  // otherwise use the DB-level count.
  const total = userEmailFilter ? filteredLogs.length : (count || 0);

  return Response.json({
    logs: processedLogs,
    total,
    page,
    pageSize,
  });
}
