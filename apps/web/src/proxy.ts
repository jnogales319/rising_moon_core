import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { isAuthRetryableFetchError } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import {
  getGuardRedirect,
  isResetPasswordConfirmPath,
} from "@/lib/route-guard";
import {
  getRecoveryMarkerSecret,
  RECOVERY_MARKER_COOKIE,
  verifyRecoveryMarker,
} from "@/lib/recovery-marker";

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

  const pathname = request.nextUrl.pathname;
  const isRetryable = !!(error && isAuthRetryableFetchError(error));

  // A retryable error (network blip, Auth-server 5xx/timeout) doesn't mean
  // the user is logged out, just that we couldn't verify right now — fail
  // open and skip the guard rather than force a spurious redirect off a
  // protected route. A definitive rejection (missing session, invalid
  // token) still goes through the normal fail-closed check below.
  //
  // The reset-password confirm page is the exception: it's security-critical
  // and must fail *closed*, so a retryable error there still runs the guard
  // (with no verified user, sending the visitor to /login).
  let redirectPath: string | null;
  if (isRetryable && !isResetPasswordConfirmPath(pathname)) {
    redirectPath = null;
  } else {
    // Only a session that arrived from a recovery email carries a valid
    // marker cookie bound to its own user id — see lib/recovery-marker.ts.
    let hasRecoveryMarker = false;
    if (isAuthenticated && data.user && isResetPasswordConfirmPath(pathname)) {
      hasRecoveryMarker = await verifyRecoveryMarker(
        request.cookies.get(RECOVERY_MARKER_COOKIE)?.value,
        {
          sub: data.user.id,
          nowMs: Date.now(),
          secret: getRecoveryMarkerSecret(),
        },
      );
    }
    redirectPath = getGuardRedirect(
      pathname,
      isAuthenticated,
      hasRecoveryMarker,
    );
  }
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
  //
  // Note this stays unset on a retryable error above, same as any other
  // failed check: we have no verified user to forward, so SiteHeader will
  // render logged-out until the next successful check. That's an accepted
  // side effect of failing open on the redirect (the user isn't bounced off
  // the page), not something to paper over by forwarding an unverified
  // identity as if it were confirmed.
  const requestHeaders = new Headers(request.headers);
  // These are a trusted channel from this proxy to Server Components
  // (SiteHeader, /account/password) — a client must never be able to set them
  // itself. Strip any inbound copy unconditionally, then re-add only the
  // identity we just verified. Without the delete, a forged
  // `x-supabase-user-id` on an unauthenticated request to a public route
  // sails straight through `new Headers(request.headers)`.
  requestHeaders.delete("x-supabase-user-id");
  requestHeaders.delete("x-supabase-user-email");
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
