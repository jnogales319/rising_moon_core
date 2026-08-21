import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";

export const VALID_PASSWORD = "Sup3r$ecret1";

export const test = base.extend<{ id: string }>({
  // A fresh id per test, safe under fullyParallel (unlike a beforeEach
  // writing to a shared module-level variable).
  id: async ({}, use) => {
    await use(randomUUID().slice(0, 8));
  },
});

export { expect };
