import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

const VALID_TIERS = ["free", "pro", "admin"] as const;

export async function POST(req: Request) {
  // 1. Auth check - verify user is logged in
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Fetch calling user's tier and verify admin status
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

  // 3. Parse and validate request body
  let body: { userId: string; tier: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { userId, tier } = body;

  if (!userId || typeof userId !== "string") {
    return Response.json({ error: "Missing or invalid userId" }, { status: 400 });
  }

  if (!tier || typeof tier !== "string") {
    return Response.json({ error: "Missing or invalid tier" }, { status: 400 });
  }

  // 4. Validate tier value
  if (!VALID_TIERS.includes(tier as any)) {
    return Response.json(
      { error: `Invalid tier. Must be one of: ${VALID_TIERS.join(", ")}` },
      { status: 400 }
    );
  }

  // 5. Use Supabase service role client to update
  const serviceRoleClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() {
          return [];
        },
        setAll() {},
      },
    }
  );

  const { error: updateError } = await serviceRoleClient
    .from("profiles")
    .update({ tier })
    .eq("id", userId);

  if (updateError) {
    console.error("Tier update failed:", updateError);
    return Response.json({ error: "Failed to update tier" }, { status: 500 });
  }

  // 6. Return success
  return Response.json({ success: true });
}
