import { expect, test } from "vitest";
import { isSafeRedirectPath } from "./safe-redirect-path";

test("accepts a relative path starting with a single slash", () => {
  expect(isSafeRedirectPath("/dashboard")).toBe(true);
});

test("accepts a nested relative path", () => {
  expect(isSafeRedirectPath("/reset-password/confirm")).toBe(true);
});

test("rejects a protocol-relative path", () => {
  expect(isSafeRedirectPath("//evil.example.com")).toBe(false);
});

test("rejects an absolute URL", () => {
  expect(isSafeRedirectPath("https://evil.example.com")).toBe(false);
});

test("rejects a path with no leading slash", () => {
  expect(isSafeRedirectPath("dashboard")).toBe(false);
});

test("rejects an empty string", () => {
  expect(isSafeRedirectPath("")).toBe(false);
});

test("rejects a backslash-smuggled protocol-relative URL", () => {
  expect(isSafeRedirectPath("/\\evil.example.com")).toBe(false);
});

test("rejects a tab-stripped protocol-relative URL", () => {
  expect(isSafeRedirectPath("/\t/evil.example.com")).toBe(false);
});

test("rejects a javascript: URL", () => {
  expect(isSafeRedirectPath("javascript:alert(1)")).toBe(false);
});
