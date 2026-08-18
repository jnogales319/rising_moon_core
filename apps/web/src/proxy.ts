import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js|map|json|woff|woff2|ttf|otf)$).*)",
  ],
};
