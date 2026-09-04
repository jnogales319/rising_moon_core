import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  createAdminClient,
  VALID_PASSWORD,
} from "./support/auth";

const MAILPIT_URL = "http://127.0.0.1:54324";

async function seedUser({
  email,
  password = VALID_PASSWORD,
}: {
  email: string;
  password?: string;
}) {
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
}

async function establishSessionViaMagicLink(page: Page, email: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "magiclink",
    email,
  });
  if (error) throw error;

  await page.goto(
    `/auth/confirm?token_hash=${data.properties.hashed_token}&type=magiclink`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
}

// Bypasses email delivery for tests that only need to land on the
// set-new-password page, not exercise the email itself.
async function generateRecoveryTokenHash(email: string) {
  const { data, error } = await createAdminClient().auth.admin.generateLink({
    type: "recovery",
    email,
  });
  if (error) throw error;
  return data.properties.hashed_token;
}

async function requestReset(page: Page, email: string) {
  await page.goto("/reset-password");
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(
    page.getByText(/check your email for a link to reset your password/i),
  ).toBeVisible();
}

async function setNewPassword(page: Page, password: string) {
  await page.getByLabel("New password", { exact: true }).fill(password);
  await page.getByLabel("Confirm new password").fill(password);
  await page.getByRole("button", { name: "Set new password" }).click();
}

test("requesting a reset, following the emailed link, and setting a new password lets the user log in with it", async ({
  page,
  id,
}) => {
  const email = `resetok-${id}@example.com`;
  await seedUser({ email });

  await requestReset(page, email);

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
      `Could not find token_hash in recovery email body: ${message.Text}`,
    );
  }

  await page.goto(
    `/auth/confirm?token_hash=${match[1]}&type=recovery&next=/reset-password/confirm`,
  );
  await expect(page).toHaveURL(/\/reset-password\/confirm$/);

  const newPassword = "Br4nd$New1";
  await setNewPassword(page, newPassword);
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(newPassword);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("requesting a reset for an unregistered email shows the same confirmation message", async ({
  page,
  id,
}) => {
  await requestReset(page, `neverregistered-${id}@example.com`);
});

test("an already-authenticated visit to /reset-password redirects to the dashboard", async ({
  page,
  id,
}) => {
  const email = `alreadyauthed-${id}@example.com`;
  await seedUser({ email });
  await establishSessionViaMagicLink(page, email);

  await page.goto("/reset-password");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("an authenticated non-recovery session visiting the confirm page is redirected to the change-password page", async ({
  page,
  id,
}) => {
  const email = `confirmguard-${id}@example.com`;
  await seedUser({ email });
  await establishSessionViaMagicLink(page, email);

  await page.goto("/reset-password/confirm");
  await expect(page).toHaveURL(/\/account\/password$/);
});

test("a logged-out visitor to the confirm page is redirected to login", async ({
  page,
}) => {
  await page.goto("/reset-password/confirm");
  await expect(page).toHaveURL(/\/login$/);
});

test("a bogus recovery token_hash redirects to the confirmation error page", async ({
  page,
}) => {
  await page.goto("/auth/confirm?token_hash=bogus&type=recovery");

  await expect(page).toHaveURL(/\/auth\/confirm\/error$/);
  await expect(
    page.getByText("This confirmation link is invalid or has expired."),
  ).toBeVisible();
});

test("a crafted absolute-URL next parameter falls back to the dashboard instead of redirecting off-site", async ({
  page,
  id,
}) => {
  const email = `nextabs-${id}@example.com`;
  await seedUser({ email });
  const tokenHash = await generateRecoveryTokenHash(email);

  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=recovery&next=https://evil.example.com`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a crafted protocol-relative next parameter falls back to the dashboard instead of redirecting off-site", async ({
  page,
  id,
}) => {
  const email = `nextproto-${id}@example.com`;
  await seedUser({ email });
  const tokenHash = await generateRecoveryTokenHash(email);

  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=recovery&next=//evil.example.com`,
  );
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("mismatched passwords on the confirm page show an inline error and do not submit", async ({
  page,
  id,
}) => {
  const email = `mismatch-${id}@example.com`;
  await seedUser({ email });
  const tokenHash = await generateRecoveryTokenHash(email);

  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password/confirm`,
  );
  await page.getByLabel("New password", { exact: true }).fill(VALID_PASSWORD);
  await page.getByLabel("Confirm new password").fill("SomethingElse1$");
  await page.getByRole("button", { name: "Set new password" }).click();

  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password\/confirm$/);
});

test("a weak new password shows GoTrue's own weak-password error", async ({
  page,
  id,
}) => {
  const email = `weakpw-${id}@example.com`;
  await seedUser({ email });
  const tokenHash = await generateRecoveryTokenHash(email);

  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password/confirm`,
  );
  await setNewPassword(page, "alllowercase");

  await expect(
    page.getByText("Password should contain at least one character of each"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/reset-password\/confirm$/);
});

test("reset-password page has no automatically detectable accessibility issues", async ({
  page,
}) => {
  await page.goto("/reset-password");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("reset-password confirm page has no automatically detectable accessibility issues", async ({
  page,
  id,
}) => {
  const email = `a11yconfirm-${id}@example.com`;
  await seedUser({ email });
  const tokenHash = await generateRecoveryTokenHash(email);

  await page.goto(
    `/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/reset-password/confirm`,
  );
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
