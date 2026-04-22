import { createClient } from "@/lib/supabase/server";

interface Claim {
  claim: string;
  verdict: "true" | "false" | "unverifiable";
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

  // 2. Parse query parameters
  const url = new URL(req.url);
  const pageStr = url.searchParams.get("page") || "1";
  const userEmailFilter = url.searchParams.get("user");
  const fromDate = url.searchParams.get("from");
  const toDate = url.searchParams.get("to");

  const page = Math.max(1, parseInt(pageStr, 10) || 1);
  const pageSize = 20;
  const offset = (page - 1) * pageSize;

  // 3. Build query - use select with join syntax for Supabase
  let query = supabase
    .from("api_logs")
    .select("*, profiles!user_id(email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + pageSize - 1);

  // Apply date filters
  if (fromDate) {
    query = query.gte("created_at", fromDate);
  }

  if (toDate) {
    query = query.lte("created_at", toDate);
  }

  const { data: logs, count, error: logsError } = await query;

  if (logsError) {
    console.error("Logs query failed:", logsError);
    return Response.json({ error: "Failed to fetch logs" }, { status: 500 });
  }

  // 4. Process results: extract emails, filter by email if needed, compute verdict counts
  const processedLogs = (logs || [])
    .map((log: any) => {
      const email = log.profiles?.email || "unknown";

      // Compute verdict counts from claims array
      let true_count = 0;
      let false_count = 0;
      let unverifiable_count = 0;

      if (Array.isArray(log.claims)) {
        log.claims.forEach((claim: Claim) => {
          if (claim.verdict === "true") true_count++;
          else if (claim.verdict === "false") false_count++;
          else if (claim.verdict === "unverifiable") unverifiable_count++;
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
    })
    .filter((log) => {
      // Apply email filter if provided
      if (userEmailFilter) {
        return log.user_email
          .toLowerCase()
          .includes(userEmailFilter.toLowerCase());
      }
      return true;
    });

  // 5. Return paginated results
  return Response.json({
    logs: processedLogs,
    total: count || 0,
    page,
    pageSize,
  });
}
