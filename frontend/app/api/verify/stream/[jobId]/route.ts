export const runtime = "edge";

import { createServerClient } from "@supabase/ssr";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ jobId: string }> }
) {
  // 1. Await dynamic params
  const { jobId } = await params;

  // 2. Parse url and use_vision from search params
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url") ?? "";
  const use_vision = searchParams.get("use_vision") === "true";

  // 3. Validate session using service role client (edge-safe, no cookie mutations needed for auth read)
  //    We still need to read the auth cookie to identify the user. Use anon key + cookie for auth,
  //    then use service role key for DB writes to bypass RLS.
  const supabaseAuth = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          const cookieHeader = req.headers.get("cookie") ?? "";
          return cookieHeader.split(";").flatMap((pair) => {
            const eqIdx = pair.indexOf("=");
            if (eqIdx === -1) return [];
            const name = pair.slice(0, eqIdx).trim();
            const value = pair.slice(eqIdx + 1).trim();
            return [{ name, value }];
          });
        },
        setAll() {
          // Edge route — cannot set cookies on incoming request
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 4. Fetch the SSE stream from FastAPI
  const backendRes = await fetch(`${BACKEND_URL}/verify/stream/${jobId}`);

  if (!backendRes.ok || !backendRes.body) {
    return new Response(JSON.stringify({ error: "Processing server unavailable" }), {
      status: 502,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Service-role client for DB writes (bypasses RLS)
  const supabaseAdmin = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return []; },
        setAll() {},
      },
    }
  );

  // 5. Create a TransformStream to intercept events, collect data, and write to Supabase on done
  const claimResults: { text: string; verdict: string; explanation: string; source: string }[] = [];
  let extractedText = "";

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();

  let leftover = "";

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>({
    async transform(chunk, controller) {
      // Forward the raw chunk to the client immediately
      controller.enqueue(chunk);

      // Decode and parse SSE lines to intercept events
      // Prepend any incomplete line carried over from the previous chunk
      const text = leftover + decoder.decode(chunk, { stream: true });
      const lines = text.split("\n");

      // The last element may be an incomplete line — save it for the next chunk
      leftover = lines[lines.length - 1];

      for (const line of lines.slice(0, -1)) {
        if (!line.startsWith("data:")) continue;

        const jsonStr = line.slice(5).trim();
        if (!jsonStr) continue;

        let event: { type: string; [key: string]: unknown };
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        if (event.type === "result") {
          claimResults.push({
            text: event.text as string,
            verdict: event.verdict as string,
            explanation: event.explanation as string,
            source: event.source as string,
          });
        } else if (event.type === "text") {
          extractedText = event.content as string;
        } else if (event.type === "done") {
          // Write to processed_reels (upsert) and api_logs
          const upsertPromise = supabaseAdmin
            .from("processed_reels")
            .upsert(
              {
                url,
                use_vision,
                extracted_text: extractedText,
                claims: claimResults,
              },
              { onConflict: "url,use_vision" }
            )
            .then(({ error }) => {
              if (error) console.error("processed_reels upsert failed:", error);
            });

          const insertPromise = supabaseAdmin
            .from("api_logs")
            .insert({
              user_id: user.id,
              url,
              use_vision,
              claims: claimResults,
            })
            .then(({ error }) => {
              if (error) console.error("api_logs insert failed:", error);
            });

          await Promise.all([upsertPromise, insertPromise]);
        }
      }
    },

    flush(_controller) {
      // Process any remaining incomplete line left in the buffer
      const line = leftover.trim();
      leftover = "";
      if (line.startsWith("data:")) {
        const jsonStr = line.slice(5).trim();
        if (jsonStr) {
          try {
            JSON.parse(jsonStr); // validate — actual side-effects were already handled in transform
          } catch {
            // ignore malformed trailing data
          }
        }
      }
      // Stream closes naturally — no controller.terminate() needed
    },
  });

  // Pipe backend response body through our transform
  backendRes.body.pipeTo(writable).catch((err) => {
    console.error("Stream pipe error:", err);
  });

  // 6. Return the transformed stream to the client
  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
