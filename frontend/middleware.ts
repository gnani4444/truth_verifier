import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that are always accessible without a session
const PUBLIC_ROUTES = ["/login", "/register"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Build a response object that we can attach refreshed session cookies to
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // First mirror onto the request so downstream server components see them
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          // Rebuild the response so the updated request is carried forward
          supabaseResponse = NextResponse.next({ request });
          // Then write them onto the outgoing response
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not add any logic between createServerClient and getUser()
  // that could short-circuit before the session cookie refresh happens.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // --- Route protection ---

  const isPublicRoute = PUBLIC_ROUTES.includes(pathname);

  if (!user && !isPublicRoute) {
    // Unauthenticated user trying to access a protected route → redirect to /login
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // --- Admin tier check (only for /admin* routes) ---
  if (user && (pathname === "/admin" || pathname.startsWith("/admin/"))) {
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tier")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.tier !== "admin") {
      // Fail closed: DB error or non-admin tier → redirect to home
      const homeUrl = request.nextUrl.clone();
      homeUrl.pathname = "/";
      return NextResponse.redirect(homeUrl);
    }
  }

  // Always return the response so refreshed session cookies are forwarded
  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico   (favicon)
     *   - api/          (API routes — handled server-side, no auth middleware needed)
     */
    "/((?!_next/static|_next/image|favicon.ico|api/).*)",
  ],
};
