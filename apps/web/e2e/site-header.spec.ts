import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  test,
  expect,
  createAdminClient,
  VALID_PASSWORD,
} from "./support/auth";

// Seeds a confirmed user with a display name via the admin API — mirrors
// register/page.tsx's signUp({ options: { data: { display_name } } }) call
// closely enough that the same handle_new_user trigger populates `profiles`.
async function seedUser({
  email,
  displayName,
  password = VALID_PASSWORD,
}: {
  email: string;
  displayName: string;
  password?: string;
}) {
  const { error } = await createAdminClient().auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
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

test("logged out, the header links back home and to login", async ({
  page,
}) => {
  await page.goto("/");
  const header = page.getByRole("banner");

  await expect(
    header.getByRole("link", { name: "Rising Moon" }),
  ).toHaveAttribute("href", "/");
  await expect(header.getByRole("link", { name: "Log in" })).toHaveAttribute(
    "href",
    "/login",
  );
});

test("the header renders from the root layout, not just the home page", async ({
  page,
}) => {
  await page.goto("/register");

  await expect(
    page.getByRole("banner").getByRole("link", { name: "Rising Moon" }),
  ).toBeVisible();
});

test("the header does not link to login while already on the login page", async ({
  page,
}) => {
  await page.goto("/login");

  await expect(
    page.getByRole("banner").getByRole("link", { name: "Log in" }),
  ).toHaveCount(0);
});

test("logged in, the header shows the display name and no login link", async ({
  page,
  id,
}) => {
  const email = `header-${id}@example.com`;
  const displayName = `HeaderOwl-${id}`;
  await seedUser({ email, displayName });
  await establishSessionViaMagicLink(page, email);

  const header = page.getByRole("banner");
  await expect(header.getByText(displayName)).toBeVisible();
  await expect(header.getByRole("link", { name: "Log in" })).toHaveCount(0);
});

test("logged-in header has no automatically detectable accessibility issues, closed or with the account menu open", async ({
  page,
  id,
}) => {
  const email = `headera11y-${id}@example.com`;
  const displayName = `HeaderA11y-${id}`;
  await seedUser({ email, displayName });
  await establishSessionViaMagicLink(page, email);

  const closedResults = await new AxeBuilder({ page }).analyze();
  expect(closedResults.violations).toEqual([]);

  await page
    .getByRole("banner")
    .getByRole("button", { name: displayName })
    .click();
  await expect(page.getByRole("menu")).toBeVisible();

  const openResults = await new AxeBuilder({ page }).analyze();
  expect(openResults.violations).toEqual([]);
});

test("the account menu opens and closes with the keyboard", async ({
  page,
  id,
}) => {
  const email = `menukbd-${id}@example.com`;
  const displayName = `MenuKbd-${id}`;
  await seedUser({ email, displayName });
  await establishSessionViaMagicLink(page, email);

  const header = page.getByRole("banner");
  const trigger = header.getByRole("button", { name: displayName });
  await trigger.focus();

  await page.keyboard.press("Enter");
  await expect(header.getByRole("menu")).toBeVisible();

  // A second Enter press toggles it closed again, via the same handler
  // that handles a mouse click.
  await page.keyboard.press("Enter");
  await expect(header.getByRole("menu")).toHaveCount(0);

  await page.keyboard.press("Enter");
  await expect(header.getByRole("menu")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(header.getByRole("menu")).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("logging out clears the session, redirects to /login, and updates the header", async ({
  page,
  id,
}) => {
  const email = `logout-${id}@example.com`;
  const displayName = `LogoutOwl-${id}`;
  await seedUser({ email, displayName });
  await establishSessionViaMagicLink(page, email);

  const header = page.getByRole("banner");
  await header.getByRole("button", { name: displayName }).click();
  await header.getByRole("menuitem", { name: "Log out" }).click();

  await expect(page).toHaveURL(/\/login$/);
  await expect(header.getByText(displayName)).toHaveCount(0);

  await page.goto("/");
  await expect(
    page.getByRole("banner").getByRole("link", { name: "Log in" }),
  ).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login$/);
});
