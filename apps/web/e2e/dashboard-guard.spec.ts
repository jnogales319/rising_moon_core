import { test, expect } from "@playwright/test";

test("logged-out user visiting /dashboard is redirected to /login", async ({
  page,
}) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
