import { expect, test } from "vitest";
import { getGuardRedirect } from "./route-guard";

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

test("does not redirect an authenticated user on the reset-password confirm route", () => {
  expect(getGuardRedirect("/reset-password/confirm", true)).toBeNull();
});

test("does not redirect an unauthenticated user on the reset-password confirm route", () => {
  expect(getGuardRedirect("/reset-password/confirm", false)).toBeNull();
});
