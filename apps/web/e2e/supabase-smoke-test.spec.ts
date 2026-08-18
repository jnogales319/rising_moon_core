import { test, expect } from "@playwright/test";

test("supabase smoke test page wires up both clients", async ({ page }) => {
  const response = await page.goto("/supabase-smoke-test");
  expect(response?.status()).toBe(200);

  await expect(
    page.getByRole("heading", { level: 1, name: "Supabase Smoke Test" }),
  ).toBeVisible();

  // No live Supabase instance or env vars in CI, so we only assert the
  // wiring resolved to *some* final state — not that it's "connected".
  await expect(page.getByTestId("server-status")).toHaveText(
    /Server client: (connected|error)/,
  );
  await expect(page.getByTestId("client-status")).toHaveText(
    /Browser client: (connected|error)/,
  );
  await expect(page.getByTestId("server-profile")).toHaveText(
    /Profile: (no user|no profile row|display_name: .*|error: .*)/,
  );
});
