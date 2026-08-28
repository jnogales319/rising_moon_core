import { expect, test } from "vitest";
import { getErrorMessage } from "./error-message";

test("returns an Error's message", () => {
  expect(getErrorMessage(new Error("boom"))).toBe("boom");
});

test("returns a fallback message for a non-Error value", () => {
  expect(getErrorMessage("boom")).toBe("Something went wrong.");
});
