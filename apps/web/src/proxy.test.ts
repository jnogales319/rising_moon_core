import { NextRequest } from "next/server";
import { afterEach, expect, test, vi } from "vitest";
import {
  AuthSessionMissingError,
  type CookieOptions,
} from "@supabase/supabase-js";

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

const { proxy } = await import("./proxy");

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
