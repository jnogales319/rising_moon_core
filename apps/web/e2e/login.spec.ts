import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { test, expect, VALID_PASSWORD } from "./support/auth";

function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy apps/web/.env.local.example to apps/web/.env.local and fill in values from `supabase status`.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

// Seeds a user directly via GoTrue's admin API rather than driving
// /register + Mailpit — registration and confirmation are already covered
// by register.spec.ts/auth-confirm.spec.ts, so this file only needs an
// account in a given state to log in against.
async function seedUser({
  email,
  password = VALID_PASSWORD,
  confirmed = true,
}: {
  email: string;
  password?: string;
  confirmed?: boolean;
}) {
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: confirmed,
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

async function fillAndSubmit(
  page: Page,
  { email, password = VALID_PASSWORD }: { email: string; password?: string },
) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Log in" }).click();
}

test("logging in with a confirmed account's credentials redirects to the dashboard", async ({
  page,
  id,
}) => {
  const email = `loginok-${id}@example.com`;
  await seedUser({ email });

  await fillAndSubmit(page, { email });
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("a wrong password shows GoTrue's own error and does not redirect", async ({
  page,
  id,
}) => {
  const email = `wrongpw-${id}@example.com`;
  await seedUser({ email });

  await fillAndSubmit(page, { email, password: "NotTheRightPassw0rd!" });
  await expect(page.getByText("Invalid login credentials")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("an unregistered email shows GoTrue's own error and does not redirect", async ({
  page,
  id,
}) => {
  await fillAndSubmit(page, {
    email: `neverregistered-${id}@example.com`,
    password: VALID_PASSWORD,
  });

  await expect(page.getByText("Invalid login credentials")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("an unconfirmed account shows GoTrue's own error and does not redirect", async ({
  page,
  id,
}) => {
  const email = `unconfirmed-${id}@example.com`;
  await seedUser({ email, confirmed: false });

  await fillAndSubmit(page, { email });
  await expect(page.getByText("Email not confirmed")).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
});

test("an already-authenticated visit to /login redirects to the dashboard", async ({
  page,
  id,
}) => {
  const email = `alreadyauthed-${id}@example.com`;
  await seedUser({ email });
  await establishSessionViaMagicLink(page, email);

  await page.goto("/login");
  await expect(page).toHaveURL(/\/dashboard$/);
});

test("links to the registration page", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("main").getByRole("link", { name: "Sign up" }).click();
  await expect(page).toHaveURL(/\/register$/);
});

test("login page has no automatically detectable accessibility issues", async ({
  page,
}) => {
  await page.goto("/login");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
