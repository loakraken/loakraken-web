// Armour CP in the simulator with ARMOR_CP_SIM OFF (production's default until the api's armour CP gate opens). The
// main config runs with it on (the non-production default, as KARMA_SIM); this one starts its own production server
// (the same standalone build, E2E_SKIP_BUILD=1 reuses it) on its own port with ARMOR_CP_SIM=off, so the off screens
// are checked in a browser too (PM-프론트 #1843 P2). Run after the main suite:
// npx playwright test -c playwright.armor-off.config.mjs
import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = Number(process.env.E2E_ARMOR_OFF_PORT ?? 3204);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3201);
const baseURL = `http://127.0.0.1:${WEB_PORT}`;
const channel = process.env.E2E_CHANNEL ?? "chrome";
const browser = channel === "chromium" ? {} : { channel };

export default defineConfig({
  testDir: ".",
  testMatch: ["armor-off/**/*.spec.mjs"],
  outputDir: "test-results-armor-off",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // A retry-pass still fails CI (PM-프론트 #1843 P3).
  failOnFlakyTests: !!process.env.CI,
  workers: 1,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "armor-off",
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 1440, height: 900 } },
    },
  ],
  webServer: [
    {
      command: "node ../tests/mock-backend.mjs",
      env: { MOCK_PORT: String(MOCK_PORT) },
      url: `http://127.0.0.1:${MOCK_PORT}/__counts`,
      reuseExistingServer: !process.env.CI,
      timeout: 30_000,
    },
    {
      command: "node support/standalone-server.mjs",
      env: {
        LOAKRAKEN_API_ORIGIN: `http://127.0.0.1:${MOCK_PORT}`,
        ARMOR_CP_SIM: "off",
        E2E_SKIP_BUILD: process.env.E2E_SKIP_BUILD ?? "1",
        PORT: String(WEB_PORT),
      },
      url: baseURL,
      // Never another server on this port: it may run with the flag on.
      reuseExistingServer: false,
      timeout: 600_000,
    },
  ],
});
