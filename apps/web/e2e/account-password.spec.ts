import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  createAdminClient,
  VALID_PASSWORD,
} from "./support/auth";

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

// A normal (non-recovery) authenticated session: the realistic state for
// someone deliberately changing their password from inside the app.
async function establishSession(page: Page, email: string) {
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

async function fillChangeForm(
  page: Page,
  { current, next }: { current: string; next: string },
) {
  await page.getByLabel("Current password").fill(current);
  await page.getByLabel("New password", { exact: true }).fill(next);
  await page.getByLabel("Confirm new password").fill(next);
  await page.getByRole("button", { name: "Update password" }).click();
}

async function expectLoginResult(
  page: Page,
  { email, password }: { email: string; password: string },
) {
  // Changing the password (or failing to) leaves the current session live, so
  // start from a clean slate — otherwise the proxy redirects /login straight
  // to /dashboard and there's no form to fill.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("a logged-out visitor to /account/password is redirected to login", async ({
  page,
}) => {
  await page.goto("/account/password");
  await expect(page).toHaveURL(/\/login$/);
});

test("a logged-in user can change their password and then log in with the new one", async ({
  page,
  id,
}) => {
  const email = `changeok-${id}@example.com`;
  const newPassword = "Br4nd$New2";
  await seedUser({ email });
  await establishSession(page, email);

  await page.goto("/account/password");
  await fillChangeForm(page, { current: VALID_PASSWORD, next: newPassword });

  await expect(page.getByText("Your password has been updated.")).toBeVisible();
  await expect(page).toHaveURL(/\/account\/password$/);

  // The old password no longer works...
  await expectLoginResult(page, { email, password: VALID_PASSWORD });
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText(/invalid login credentials/i)).toBeVisible();

  // ...and the new one does.
  await expectLoginResult(page, { email, password: newPassword });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("an incorrect current password shows an error and does not change the password", async ({
  page,
  id,
}) => {
  const email = `wrongcurrent-${id}@example.com`;
  await seedUser({ email });
  await establishSession(page, email);

  await page.goto("/account/password");
  await fillChangeForm(page, {
    current: "NotMyPassword9$",
    next: "Br4nd$New2",
  });

  await expect(page.getByText("Current password is incorrect.")).toBeVisible();
  await expect(page).toHaveURL(/\/account\/password$/);

  // The original password still logs in.
  await expectLoginResult(page, { email, password: VALID_PASSWORD });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a weak new password surfaces GoTrue's own weak-password error", async ({
  page,
  id,
}) => {
  const email = `weaknew-${id}@example.com`;
  await seedUser({ email });
  await establishSession(page, email);

  await page.goto("/account/password");
  await fillChangeForm(page, {
    current: VALID_PASSWORD,
    next: "alllowercase",
  });

  await expect(
    page.getByText("Password should contain at least one character of each"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/account\/password$/);
});

test("mismatched new and confirm fields block the request client-side", async ({
  page,
  id,
}) => {
  const email = `mismatch-${id}@example.com`;
  await seedUser({ email });
  await establishSession(page, email);

  await page.goto("/account/password");
  await page.getByLabel("Current password").fill(VALID_PASSWORD);
  await page.getByLabel("New password", { exact: true }).fill("Br4nd$New2");
  await page.getByLabel("Confirm new password").fill("Different3$");
  await page.getByRole("button", { name: "Update password" }).click();

  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/account\/password$/);

  // Nothing was changed: the original password still works.
  await expectLoginResult(page, { email, password: VALID_PASSWORD });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("the change-password page has no automatically detectable accessibility issues", async ({
  page,
  id,
}) => {
  const email = `a11y-${id}@example.com`;
  await seedUser({ email });
  await establishSession(page, email);

  await page.goto("/account/password");
  await expect(page.getByLabel("Current password")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
