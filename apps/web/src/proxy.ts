import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getGuardRedirect } from "@/lib/route-guard";

export async function proxy(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // No Supabase config available (CI, or a dev box that hasn't copied
  // .env.local yet) — skip session refresh instead of crashing every request.
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  // This cookie adapter is intentionally separate from lib/supabase/server.ts's
  // — that one reads/writes through next/headers' cookies() store (Server
  // Components/Route Handlers), this one reads/writes through the
  // NextRequest/NextResponse cookie APIs (only available here). If you
  // change error handling or header behavior in one, check the other.
  //
  // @supabase/ssr can call setAll more than once per request (e.g. a
  // cookie-clearing pass followed by a session-refresh write). Each call
  // below rebuilds `response` from a fresh NextResponse.next({ request })
  // so downstream rendering sees the updated request cookies, which would
  // otherwise silently drop any cookie or header set by an earlier call — so
  // every cookie and header ever passed to setAll is replayed onto each
  // rebuilt response.
  const pendingCookies: {
    name: string;
    value: string;
    options: CookieOptions;
  }[] = [];
  const pendingHeaders = new Map<string, string>();

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        pendingCookies.push(...cookiesToSet);
        Object.entries(headers).forEach(([key, value]) =>
          pendingHeaders.set(key, value),
        );

        response = NextResponse.next({ request });
        pendingCookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        pendingHeaders.forEach((value, key) =>
          response.headers.set(key, value),
        );
      },
    },
  });

  // getUser() (not getSession()) revalidates with the Auth server, which is
  // what actually triggers a token refresh and a rewritten cookie.
  const { data, error } = await supabase.auth.getUser();
  // An AuthSessionMissingError just means there's no logged-in user — that's
  // expected, not a failure (same convention as supabase-smoke-test).
  if (error && error.name !== "AuthSessionMissingError") {
    console.error("proxy auth check failed:", error);
  }
  const isAuthenticated = !error && !!data.user;

  const redirectPath = getGuardRedirect(
    request.nextUrl.pathname,
    isAuthenticated,
  );
  if (redirectPath) {
    const redirectResponse = NextResponse.redirect(
      new URL(redirectPath, request.url),
    );
    response.cookies.getAll().forEach((cookie) => {
      redirectResponse.cookies.set(cookie);
    });
    // Copy from pendingHeaders (never contains set-cookie), not raw
    // response.headers -- response.headers.forEach yields one entry per
    // Set-Cookie value (they aren't comma-combined), and replaying those
    // through Headers.set in a loop would overwrite all but the last one,
    // corrupting a session that @supabase/ssr split into multiple cookies.
    pendingHeaders.forEach((value, key) => {
      redirectResponse.headers.set(key, value);
    });
    return redirectResponse;
  }

  // Forward the already-verified user onto the request so a Server Component
  // (e.g. SiteHeader) can read it via next/headers' headers() instead of
  // making its own getUser() round trip to the Auth server for every render.
  const requestHeaders = new Headers(request.headers);
  if (isAuthenticated && data.user) {
    requestHeaders.set("x-supabase-user-id", data.user.id);
    if (data.user.email) {
      requestHeaders.set("x-supabase-user-email", data.user.email);
    }
  }
  response = NextResponse.next({ request: { headers: requestHeaders } });
  pendingCookies.forEach(({ name, value, options }) =>
    response.cookies.set(name, value, options),
  );
  pendingHeaders.forEach((value, key) => response.headers.set(key, value));

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map|json|woff|woff2|ttf|otf)$).*)",
  ],
};
