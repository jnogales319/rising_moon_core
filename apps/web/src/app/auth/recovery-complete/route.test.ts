import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const cookieSet = vi.fn();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ set: cookieSet })),
}));

const { POST } = await import("./route");
const { RECOVERY_MARKER_COOKIE } = await import("@/lib/recovery-marker");

const URL = "http://localhost:3000/auth/recovery-complete";

function sameOriginRequest() {
  return new NextRequest(URL, {
    method: "POST",
    headers: { "sec-fetch-site": "same-origin" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "test");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

test("clears the recovery-marker cookie on a same-origin request", async () => {
  await POST(sameOriginRequest());

  expect(cookieSet).toHaveBeenCalledTimes(1);
  const [name, value, options] = cookieSet.mock.calls[0];
  expect(name).toBe(RECOVERY_MARKER_COOKIE);
  expect(value).toBe("");
  expect(options).toMatchObject({ path: "/", maxAge: 0, httpOnly: true });
});

test("accepts a request whose Origin matches the deployment origin", async () => {
  const response = await POST(
    new NextRequest(URL, {
      method: "POST",
      headers: { origin: "http://localhost:3000" },
    }),
  );

  expect(response.status).toBe(200);
  expect(cookieSet).toHaveBeenCalledTimes(1);
});

test("responds ok on a same-origin request", async () => {
  const response = await POST(sameOriginRequest());

  expect(response.status).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
});

test("rejects a cross-site request without clearing anything", async () => {
  const response = await POST(
    new NextRequest(URL, {
      method: "POST",
      headers: {
        "sec-fetch-site": "cross-site",
        origin: "https://evil.example.com",
      },
    }),
  );

  expect(response.status).toBe(403);
  expect(cookieSet).not.toHaveBeenCalled();
});

test("rejects a request with no origin signals at all", async () => {
  const response = await POST(new NextRequest(URL, { method: "POST" }));

  expect(response.status).toBe(403);
  expect(cookieSet).not.toHaveBeenCalled();
});
