import { NextRequest } from "next/server";
import { afterEach, expect, test, vi } from "vitest";
import {
  AuthApiError,
  AuthRetryableFetchError,
  AuthSessionMissingError,
} from "@supabase/supabase-js";
import type { CookieOptions } from "@supabase/ssr";

const getUser = vi.fn();
let cookieAdapter: {
  setAll: (
    cookies: { name: string; value: string; options: CookieOptions }[],
    headers: Record<string, string>,
  ) => void;
};

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn((_url, _key, options) => {
    cookieAdapter = options.cookies;
    return { auth: { getUser } };
  }),
}));

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.RECOVERY_MARKER_SECRET = "test-recovery-marker-secret";

const { proxy } = await import("./proxy");
const { signRecoveryMarker, RECOVERY_MARKER_MAX_AGE_MS } =
  await import("./lib/recovery-marker");

const CONFIRM_URL = "http://localhost:3000/reset-password/confirm";

function confirmRequest(markerCookie?: string) {
  return new NextRequest(
    CONFIRM_URL,
    markerCookie
      ? { headers: { cookie: `rm_recovery=${markerCookie}` } }
      : undefined,
  );
}

const NO_CACHE_HEADERS = {
  "cache-control": "private, no-cache, no-store, max-age=0, must-revalidate",
  expires: "0",
  pragma: "no-cache",
};

afterEach(() => {
  vi.clearAllMocks();
});

test("passes through an unauthenticated request to a public route", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthSessionMissingError(),
  });

  const response = await proxy(new NextRequest("http://localhost:3000/"));

  expect(response.headers.get("location")).toBeNull();
});

// Guards against the redirect branch dropping response headers, which loses
// no-cache directives set on a refreshed session cookie.
test("copies no-cache headers from a refreshed session onto a redirect response", async () => {
  getUser.mockImplementation(async () => {
    cookieAdapter.setAll(
      [{ name: "sb-access-token", value: "refreshed", options: {} }],
      NO_CACHE_HEADERS,
    );
    return {
      data: { user: { id: "u1", email: "a@example.com" } },
      error: null,
    };
  });

  // An authenticated user hitting the login page gets redirected to
  // /dashboard -- exercising the redirect branch in proxy.ts.
  const response = await proxy(new NextRequest("http://localhost:3000/login"));

  expect(response.headers.get("location")).toContain("/dashboard");
  expect(response.headers.get("cache-control")).toBe(
    NO_CACHE_HEADERS["cache-control"],
  );
  expect(response.headers.get("pragma")).toBe(NO_CACHE_HEADERS.pragma);
});

test("still copies refreshed session cookies onto a redirect response", async () => {
  getUser.mockImplementation(async () => {
    cookieAdapter.setAll(
      [{ name: "sb-access-token", value: "refreshed", options: {} }],
      NO_CACHE_HEADERS,
    );
    return {
      data: { user: { id: "u1", email: "a@example.com" } },
      error: null,
    };
  });

  const response = await proxy(new NextRequest("http://localhost:3000/login"));

  expect(response.cookies.get("sb-access-token")?.value).toBe("refreshed");
});

test("copies every cookie onto a redirect response when a refreshed session is split across multiple cookies", async () => {
  getUser.mockImplementation(async () => {
    // @supabase/ssr splits an oversized session JWT into chunked cookies
    // (e.g. sb-<ref>-auth-token.0, .1) written together in one setAll call.
    cookieAdapter.setAll(
      [
        { name: "sb-auth-token.0", value: "chunk-0", options: {} },
        { name: "sb-auth-token.1", value: "chunk-1", options: {} },
      ],
      NO_CACHE_HEADERS,
    );
    return {
      data: { user: { id: "u1", email: "a@example.com" } },
      error: null,
    };
  });

  const response = await proxy(new NextRequest("http://localhost:3000/login"));

  // NextResponse.cookies caches its parsed view at construction time and
  // won't reflect a header mutation made after the fact, so assert on the
  // real outgoing Set-Cookie header values instead of response.cookies.
  const setCookieHeaders = response.headers.getSetCookie();
  expect(setCookieHeaders.some((c) => c.startsWith("sb-auth-token.0="))).toBe(
    true,
  );
  expect(setCookieHeaders.some((c) => c.startsWith("sb-auth-token.1="))).toBe(
    true,
  );
});

// Route guard treated any Auth-server error as logged out, causing
// spurious redirects on transient failures.
test("does not redirect off a protected route when the auth check fails transiently", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthRetryableFetchError("network error", 0),
  });

  const response = await proxy(
    new NextRequest("http://localhost:3000/dashboard"),
  );

  expect(response.headers.get("location")).toBeNull();
});

test("does not forward an unverified identity when the auth check fails transiently", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthRetryableFetchError("network error", 0),
  });

  const response = await proxy(
    new NextRequest("http://localhost:3000/dashboard"),
  );

  // Failing open means the request isn't bounced off the page, but we still
  // have no verified user to vouch for -- SiteHeader should render
  // logged-out rather than trust an identity we couldn't confirm.
  expect(
    response.headers.get("x-middleware-request-x-supabase-user-id"),
  ).toBeNull();
});

test("forwards the verified identity to Server Components when authenticated", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "verified-id", email: "verified@example.com" } },
    error: null,
  });

  const response = await proxy(new NextRequest("http://localhost:3000/"));

  expect(response.headers.get("x-middleware-request-x-supabase-user-id")).toBe(
    "verified-id",
  );
});

test("strips a forged x-supabase-user identity header on an unauthenticated request", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthSessionMissingError(),
  });

  const response = await proxy(
    new NextRequest("http://localhost:3000/", {
      headers: {
        "x-supabase-user-id": "attacker-supplied",
        "x-supabase-user-email": "victim@example.com",
      },
    }),
  );

  expect(response.headers.get("location")).toBeNull();
  expect(
    response.headers.get("x-middleware-request-x-supabase-user-id"),
  ).toBeNull();
  expect(
    response.headers.get("x-middleware-request-x-supabase-user-email"),
  ).toBeNull();
});

test("does not let a forged identity header override the verified user", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "verified-id", email: "verified@example.com" } },
    error: null,
  });

  const response = await proxy(
    new NextRequest("http://localhost:3000/", {
      headers: { "x-supabase-user-id": "attacker-supplied" },
    }),
  );

  expect(response.headers.get("x-middleware-request-x-supabase-user-id")).toBe(
    "verified-id",
  );
});

test("still redirects to /login when there is genuinely no session", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthSessionMissingError(),
  });

  const response = await proxy(
    new NextRequest("http://localhost:3000/dashboard"),
  );

  expect(response.headers.get("location")).toContain("/login");
});

test("still redirects to /login when the auth server rejects the session outright", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthApiError("invalid token", 401, "bad_jwt"),
  });

  const response = await proxy(
    new NextRequest("http://localhost:3000/dashboard"),
  );

  expect(response.headers.get("location")).toContain("/login");
});

test("lets a genuine recovery session reach the reset-password confirm page", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "a@example.com" } },
    error: null,
  });
  const marker = await signRecoveryMarker(
    "u1",
    Date.now(),
    "test-recovery-marker-secret",
  );

  const response = await proxy(confirmRequest(marker));

  expect(response.headers.get("location")).toBeNull();
});

test("redirects an authenticated non-recovery session off the confirm page to the change-password page", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "a@example.com" } },
    error: null,
  });

  const response = await proxy(confirmRequest());

  expect(response.headers.get("location")).toContain("/account/password");
});

test("redirects off the confirm page when the recovery marker has expired", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "a@example.com" } },
    error: null,
  });
  const stale = await signRecoveryMarker(
    "u1",
    Date.now() - (RECOVERY_MARKER_MAX_AGE_MS + 60_000),
    "test-recovery-marker-secret",
  );

  const response = await proxy(confirmRequest(stale));

  expect(response.headers.get("location")).toContain("/account/password");
});

test("redirects off the confirm page when the recovery marker belongs to another user", async () => {
  getUser.mockResolvedValue({
    data: { user: { id: "u1", email: "a@example.com" } },
    error: null,
  });
  const otherUsersMarker = await signRecoveryMarker(
    "someone-else",
    Date.now(),
    "test-recovery-marker-secret",
  );

  const response = await proxy(confirmRequest(otherUsersMarker));

  expect(response.headers.get("location")).toContain("/account/password");
});

test("redirects an unauthenticated visitor off the confirm page to /login", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthSessionMissingError(),
  });

  const response = await proxy(confirmRequest());

  expect(response.headers.get("location")).toContain("/login");
});

test("fails closed to /login on a transient auth error for the confirm page", async () => {
  getUser.mockResolvedValue({
    data: { user: null },
    error: new AuthRetryableFetchError("network error", 0),
  });

  const response = await proxy(confirmRequest());

  expect(response.headers.get("location")).toContain("/login");
});
