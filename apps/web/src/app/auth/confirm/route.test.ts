import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const verifyOtp = vi.fn();
const cookieSet = vi.fn();

vi.mock("next/navigation", () => ({
  // The real redirect() throws to halt the handler — model that so control
  // flow after a redirect matches production.
  redirect: vi.fn((path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  }),
}));

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ auth: { verifyOtp } })),
}));

const { GET } = await import("./route");
const { RECOVERY_MARKER_COOKIE } = await import("@/lib/recovery-marker");

async function run(query: string): Promise<string | null> {
  try {
    await GET(new NextRequest(`http://localhost:3000/auth/confirm${query}`));
    return null;
  } catch (err) {
    const match = /^NEXT_REDIRECT:(.+)$/.exec((err as Error).message);
    if (match) return match[1];
    throw err;
  }
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RECOVERY_MARKER_SECRET", "test-confirm-secret");
  verifyOtp.mockResolvedValue({
    data: { user: { id: "user-123" } },
    error: null,
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

test("a verified recovery link mints the recovery-marker cookie and redirects to next", async () => {
  const to = await run(
    "?token_hash=abc&type=recovery&next=/reset-password/confirm",
  );

  expect(to).toBe("/reset-password/confirm");
  expect(cookieSet).toHaveBeenCalledTimes(1);
  const [name, value, options] = cookieSet.mock.calls[0];
  expect(name).toBe(RECOVERY_MARKER_COOKIE);
  expect(String(value).split(".")).toHaveLength(3);
  expect(options).toMatchObject({
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    maxAge: 3600,
  });
});

test("a verified non-recovery link does not mint a recovery marker", async () => {
  const to = await run("?token_hash=abc&type=magiclink");

  expect(to).toBe("/dashboard");
  expect(cookieSet).not.toHaveBeenCalled();
});

test("in production with no RECOVERY_MARKER_SECRET, logs an error and still completes sign-in", async () => {
  vi.stubEnv("RECOVERY_MARKER_SECRET", "");
  vi.stubEnv("NODE_ENV", "production");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  const to = await run(
    "?token_hash=abc&type=recovery&next=/reset-password/confirm",
  );

  expect(to).toBe("/reset-password/confirm");
  expect(cookieSet).not.toHaveBeenCalled();
  expect(errorSpy).toHaveBeenCalledWith(
    expect.stringContaining("RECOVERY_MARKER_SECRET"),
  );
});

test("outside production a missing RECOVERY_MARKER_SECRET falls back to the dev key and still mints the marker", async () => {
  vi.stubEnv("RECOVERY_MARKER_SECRET", "");
  vi.stubEnv("NODE_ENV", "test");
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  const to = await run(
    "?token_hash=abc&type=recovery&next=/reset-password/confirm",
  );

  expect(to).toBe("/reset-password/confirm");
  expect(cookieSet).toHaveBeenCalledTimes(1);
  expect(errorSpy).not.toHaveBeenCalled();
});

test("an invalid or expired token redirects to the confirmation error page", async () => {
  verifyOtp.mockResolvedValue({
    data: { user: null },
    error: { name: "AuthApiError", message: "Token has expired or is invalid" },
  });

  const to = await run("?token_hash=bad&type=recovery");

  expect(to).toBe("/auth/confirm/error");
  expect(cookieSet).not.toHaveBeenCalled();
});

test("a request missing token_hash or type redirects to the confirmation error page", async () => {
  const to = await run("?type=recovery");

  expect(to).toBe("/auth/confirm/error");
  expect(verifyOtp).not.toHaveBeenCalled();
  expect(cookieSet).not.toHaveBeenCalled();
});
