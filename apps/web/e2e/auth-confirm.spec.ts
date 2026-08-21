import { randomUUID } from "node:crypto";
import { test as base, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const VALID_PASSWORD = "Sup3r$ecret1";
const MAILPIT_URL = "http://127.0.0.1:54324";

const test = base.extend<{ id: string }>({
  // A fresh id per test, safe under fullyParallel (unlike a beforeEach
  // writing to a shared module-level variable).
  id: async ({}, use) => {
    await use(randomUUID().slice(0, 8));
  },
});

async function registerAndGetConfirmationUrl(
  page: Page,
  { displayName, email }: { displayName: string; email: string },
): Promise<string> {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(VALID_PASSWORD);
  await page.getByLabel("Confirm password").fill(VALID_PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(
    page.getByText(/check your email to confirm your account/i),
  ).toBeVisible();

  // Mailpit can take a beat to ingest the message GoTrue just sent, so poll
  // its search API rather than assuming it's there on the first request.
  let messageId: string | undefined;
  await expect
    .poll(
      async () => {
        const res = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(`to:${email}`)}`,
        );
        const body = await res.json();
        messageId = body.messages?.[0]?.ID;
        return messageId;
      },
      { timeout: 15_000 },
    )
    .toBeTruthy();

  const messageRes = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);
  const message = await messageRes.json();
  const match = (message.Text as string).match(/token_hash=([^&\s]+)/);
  if (!match) {
    throw new Error(
      `Could not find token_hash in confirmation email body: ${message.Text}`,
    );
  }

  return `/auth/confirm?token_hash=${match[1]}&type=signup`;
}

test("a valid confirmation link signs the user in and redirects to the dashboard", async ({
  page,
  id,
}) => {
  const confirmUrl = await registerAndGetConfirmationUrl(page, {
    displayName: `confirmok-${id}`,
    email: `confirmok-${id}@example.com`,
  });

  await page.goto(confirmUrl);
  await expect(page).toHaveURL(/\/dashboard$/);

  // Landing on /dashboard already implies a valid session cookie (it's a
  // protected path per proxy.ts's PROTECTED_PATHS — a missing/invalid
  // cookie would have bounced to /login instead). Checking
  // /supabase-smoke-test on top of that confirms it directly: the server
  // client's auth.getUser() sees a real, non-"none" user id from the
  // cookie verifyOtp set, not just that routing didn't reject us.
  await page.goto("/supabase-smoke-test");
  await expect(page.getByTestId("server-status")).not.toHaveText(/user: none/);
  await expect(page.getByTestId("server-status")).toHaveText(/connected/);
});

test("a bogus token_hash redirects to the confirmation error page", async ({
  page,
}) => {
  await page.goto("/auth/confirm?token_hash=bogus&type=signup");

  await expect(page).toHaveURL(/\/auth\/confirm\/error$/);
  await expect(
    page.getByText("This confirmation link is invalid or has expired."),
  ).toBeVisible();
});

test("missing query params redirect to the confirmation error page", async ({
  page,
}) => {
  await page.goto("/auth/confirm");

  await expect(page).toHaveURL(/\/auth\/confirm\/error$/);
  await expect(
    page.getByText("This confirmation link is invalid or has expired."),
  ).toBeVisible();
});

test("confirmation error page has no automatically detectable accessibility issues", async ({
  page,
}) => {
  await page.goto("/auth/confirm?token_hash=bogus&type=signup");
  await expect(page).toHaveURL(/\/auth\/confirm\/error$/);

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
