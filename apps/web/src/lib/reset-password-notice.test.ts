import { afterEach, expect, test } from "vitest";
import {
  consumePasswordResetSuccess,
  markPasswordResetSuccess,
} from "./reset-password-notice";

afterEach(() => {
  sessionStorage.clear();
});

test("consumePasswordResetSuccess returns false when nothing was marked", () => {
  expect(consumePasswordResetSuccess()).toBe(false);
});

test("consumePasswordResetSuccess returns true once after marking, then false", () => {
  markPasswordResetSuccess();

  expect(consumePasswordResetSuccess()).toBe(true);
  expect(consumePasswordResetSuccess()).toBe(false);
});

test("consumePasswordResetSuccess still reports success when removeItem throws", () => {
  // Cleanup is best-effort: a throwing removeItem must not turn a real
  // "flag was set" read into a false negative.
  const original = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    value: {
      getItem: () => "1",
      removeItem: () => {
        throw new Error("storage disabled");
      },
    },
  });

  try {
    expect(consumePasswordResetSuccess()).toBe(true);
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: original,
    });
  }
});

test("markPasswordResetSuccess does not throw when sessionStorage is unavailable", () => {
  const original = globalThis.sessionStorage;
  Object.defineProperty(globalThis, "sessionStorage", {
    configurable: true,
    get() {
      throw new Error("storage disabled");
    },
  });

  try {
    expect(() => markPasswordResetSuccess()).not.toThrow();
    expect(consumePasswordResetSuccess()).toBe(false);
  } finally {
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: original,
    });
  }
});
