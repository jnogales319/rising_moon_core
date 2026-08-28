import { randomUUID } from "node:crypto";
import { test as base, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

export const VALID_PASSWORD = "Sup3r$ecret1";

export const test = base.extend<{ id: string }>({
  // A fresh id per test, safe under fullyParallel (unlike a beforeEach
  // writing to a shared module-level variable).
  id: async ({}, use) => {
    await use(randomUUID().slice(0, 8));
  },
});

export { expect };

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY. Copy apps/web/.env.local.example to apps/web/.env.local and fill in values from `supabase status`.",
    );
  }

  return createClient(supabaseUrl, serviceRoleKey);
}
