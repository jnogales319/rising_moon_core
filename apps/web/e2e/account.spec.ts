import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  createAdminClient,
  VALID_PASSWORD,
} from "./support/auth";

async function seedUser({ email }: { email: string }) {
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password: VALID_PASSWORD,
    email_confirm: true,
  });
  if (error) throw error;
}

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

test("a logged-out visitor to /account is redirected to login", async ({
  page,
}) => {
  await page.goto("/account");
  await expect(page).toHaveURL(/\/login$/);
});

test("a logged-in user can visit /account and reach the change-password page", async ({
  page,
  id,
}) => {
  const email = `account-${id}@example.com`;
  await seedUser({ email });
  await establishSession(page, email);

  await page.goto("/account");
  await expect(
    page.getByRole("heading", { level: 1, name: "Account" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "Change your password" }).click();
  await expect(page).toHaveURL(/\/account\/password$/);
});

test("the account page has no automatically detectable accessibility issues", async ({
  page,
  id,
}) => {
  const email = `account-a11y-${id}@example.com`;
  await seedUser({ email });
  await establishSession(page, email);

  await page.goto("/account");
  await expect(
    page.getByRole("heading", { level: 1, name: "Account" }),
  ).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
