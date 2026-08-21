import type { Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { test, expect, VALID_PASSWORD } from "./support/auth";

async function fillAndSubmit(
  page: Page,
  {
    displayName,
    email,
    password = VALID_PASSWORD,
    confirmPassword = password,
  }: {
    displayName: string;
    email: string;
    password?: string;
    confirmPassword?: string;
  },
) {
  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(confirmPassword);
  await page.getByRole("button", { name: "Create account" }).click();
}

test("a valid submission shows the check-your-email message and does not redirect", async ({
  page,
  id,
}) => {
  await fillAndSubmit(page, {
    displayName: `nightowl-${id}`,
    email: `nightowl-${id}@example.com`,
  });

  await expect(
    page.getByText(/check your email to confirm your account/i),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("mismatched passwords show an inline error and do not submit", async ({
  page,
  id,
}) => {
  await fillAndSubmit(page, {
    displayName: `nightowl-${id}`,
    email: `nightowl-${id}@example.com`,
    password: VALID_PASSWORD,
    confirmPassword: "SomethingElse1$",
  });

  await expect(page.getByText("Passwords do not match.")).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("registering the same display name twice shows the taken message via the pre-check", async ({
  page,
  id,
}) => {
  const displayName = `dupname-${id}`;

  await fillAndSubmit(page, {
    displayName,
    email: `dupname-a-${id}@example.com`,
  });
  await expect(
    page.getByText(/check your email to confirm your account/i),
  ).toBeVisible();

  await fillAndSubmit(page, {
    displayName,
    email: `dupname-b-${id}@example.com`,
  });
  await expect(page.getByText("That display name is taken.")).toBeVisible();
});

test("display name uniqueness is case-insensitive", async ({ page, id }) => {
  const displayName = `CaseOwl-${id}`;

  await fillAndSubmit(page, {
    displayName,
    email: `caseowl-a-${id}@example.com`,
  });
  await expect(
    page.getByText(/check your email to confirm your account/i),
  ).toBeVisible();

  await fillAndSubmit(page, {
    displayName: displayName.toLowerCase(),
    email: `caseowl-b-${id}@example.com`,
  });
  await expect(page.getByText("That display name is taken.")).toBeVisible();
});

test("typing an already-registered display name shows the taken status live, without submitting", async ({
  page,
  id,
}) => {
  const displayName = `livecheck-${id}`;
  await fillAndSubmit(page, {
    displayName,
    email: `livecheck-a-${id}@example.com`,
  });
  await expect(
    page.getByText(/check your email to confirm your account/i),
  ).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);

  await expect(page.getByText("That display name is taken.")).toBeVisible();
});

test("a password missing required character classes shows GoTrue's weak-password error", async ({
  page,
  id,
}) => {
  await fillAndSubmit(page, {
    displayName: `weakpw-${id}`,
    email: `weakpw-${id}@example.com`,
    password: "alllowercase",
    confirmPassword: "alllowercase",
  });

  await expect(
    page.getByText("Password should contain at least one character of each"),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/register$/);
});

test("links to the login page", async ({ page }) => {
  await page.goto("/register");
  await page.getByRole("link", { name: "Log in" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("register page has no automatically detectable accessibility issues", async ({
  page,
}) => {
  await page.goto("/register");
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("register page has no automatically detectable accessibility issues once a taken display name is flagged", async ({
  page,
  id,
}) => {
  const displayName = `a11ytaken-${id}`;
  await fillAndSubmit(page, {
    displayName,
    email: `a11ytaken-a-${id}@example.com`,
  });
  await expect(
    page.getByText(/check your email to confirm your account/i),
  ).toBeVisible();

  await page.goto("/register");
  await page.getByLabel("Display name").fill(displayName);
  await expect(page.getByText("That display name is taken.")).toBeVisible();

  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
