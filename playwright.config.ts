import { defineConfig } from "@playwright/test";
import { E2E_BASE_URL, E2E_PORT, e2eEnv } from "./tests/e2e/env";

/**
 * E2E: `bun run build` → `bun run test:e2e`.
 * Own local DB (cless_e2e, reset on every run) — never Supabase.
 * Browser: `bunx playwright install chromium` or E2E_CHROMIUM_PATH=<chromium binary>.
 */
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "**/*.e2e.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  use: {
    baseURL: E2E_BASE_URL,
    viewport: { width: 1400, height: 950 },
    launchOptions: process.env.E2E_CHROMIUM_PATH ? { executablePath: process.env.E2E_CHROMIUM_PATH } : {},
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    // DB-г сервер эхлэхээс ӨМНӨ бэлдэнэ (globalSetup нь серверийн дараа ажилладаг)
    command: `bun tests/e2e/prepare-db.ts && bunx next start --port ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/admin/login`,
    env: e2eEnv() as Record<string, string>,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
