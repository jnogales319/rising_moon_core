import { defineConfig } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

// The webServer subprocess (next build/start) loads .env.local itself, but
// this config's own process — and therefore the test files it runs — does
// not get that for free. Tests that need e.g. SUPABASE_SERVICE_ROLE_KEY for
// admin-API setup rely on this.
loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  webServer: {
    command: "npm run build && npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  use: {
    baseURL: "http://localhost:3000",
  },
});
