import { expect, test } from "vitest";
import { getGuardRedirect, isResetPasswordConfirmPath } from "./route-guard";

test("redirects an unauthenticated user away from a protected route", () => {
  expect(getGuardRedirect("/dashboard", false)).toBe("/login");
});

test("redirects an unauthenticated user away from a nested protected route", () => {
  expect(getGuardRedirect("/dashboard/characters", false)).toBe("/login");
});

test("does not redirect an authenticated user on a protected route", () => {
  expect(getGuardRedirect("/dashboard", true)).toBeNull();
});

test("redirects an authenticated user away from the login route", () => {
  expect(getGuardRedirect("/login", true)).toBe("/dashboard");
});

test("redirects an authenticated user away from the register route", () => {
  expect(getGuardRedirect("/register", true)).toBe("/dashboard");
});

test("does not redirect an unauthenticated user on the login route", () => {
  expect(getGuardRedirect("/login", false)).toBeNull();
});

test("does not redirect an unauthenticated user on the register route", () => {
  expect(getGuardRedirect("/register", false)).toBeNull();
});

test("does not redirect an authenticated user on an unlisted public route", () => {
  expect(getGuardRedirect("/", true)).toBeNull();
});

test("does not redirect an unauthenticated user on an unlisted public route", () => {
  expect(getGuardRedirect("/", false)).toBeNull();
});

test("redirects an authenticated user away from the reset-password route", () => {
  expect(getGuardRedirect("/reset-password", true)).toBe("/dashboard");
});

test("does not redirect an unauthenticated user on the reset-password route", () => {
  expect(getGuardRedirect("/reset-password", false)).toBeNull();
});

test("does not redirect a genuine recovery session on the reset-password confirm route", () => {
  expect(getGuardRedirect("/reset-password/confirm", true, true)).toBeNull();
});

test("redirects an authenticated non-recovery session off the confirm route to the in-app change-password page", () => {
  expect(getGuardRedirect("/reset-password/confirm", true, false)).toBe(
    "/account/password",
  );
});

test("redirects an unauthenticated visitor off the confirm route to login", () => {
  expect(getGuardRedirect("/reset-password/confirm", false, false)).toBe(
    "/login",
  );
});

test("treats a missing recovery-marker argument as no recovery session", () => {
  expect(getGuardRedirect("/reset-password/confirm", true)).toBe(
    "/account/password",
  );
});

test("redirects an unauthenticated user away from the account area", () => {
  expect(getGuardRedirect("/account/password", false)).toBe("/login");
});

test("redirects an unauthenticated user away from a nested account route", () => {
  expect(getGuardRedirect("/account/settings", false)).toBe("/login");
});

test("does not redirect an authenticated user in the account area", () => {
  expect(getGuardRedirect("/account/password", true)).toBeNull();
});

test("isResetPasswordConfirmPath matches the confirm route", () => {
  expect(isResetPasswordConfirmPath("/reset-password/confirm")).toBe(true);
});

test("isResetPasswordConfirmPath does not match the reset-password request route", () => {
  expect(isResetPasswordConfirmPath("/reset-password")).toBe(false);
});

test("isResetPasswordConfirmPath does not match an unrelated route", () => {
  expect(isResetPasswordConfirmPath("/dashboard")).toBe(false);
});
