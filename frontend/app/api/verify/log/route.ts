import { createClient } from "@/lib/supabase/server";
import { createServerClient } from "@supabase/ssr";

export async function POST(req: Request) {
  const { url, use_vision, claims } = await req.json();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const supabaseAdmin = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        { cookies: { getAll() { return []; }, setAll() {} } }
      )
    : null;

  const logger = supabaseAdmin ?? supabase;
  const { error } = await logger.from("api_logs").insert({
    user_id: user.id,
    url,
    use_vision,
    claims,
  });

  if (error) {
    console.error("api_logs insert failed:", JSON.stringify(error), { user_id: user.id, url });
    return Response.json({ error: "Failed to log" }, { status: 500 });
  }

  return Response.json({ ok: true });
}
