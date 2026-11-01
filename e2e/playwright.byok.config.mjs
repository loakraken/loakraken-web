// The user's own API key (BYOK, api #804) with the flag ON. The main config
// keeps the flag off (the default); this one starts its own production server
// (the same standalone build, E2E_SKIP_BUILD=1 reuses it) on its own port with
// BYOK_ENABLED=true and a throwaway seal key written to a temp file for this
// run only. Run after the main suite: npx playwright test -c playwright.byok.config.mjs
import { randomBytes } from "node:crypto";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = Number(process.env.E2E_BYOK_PORT ?? 3203);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3201);
const baseURL = `http://127.0.0.1:${WEB_PORT}`;
const channel = process.env.E2E_CHANNEL ?? "chrome";
const browser = channel === "chromium" ? {} : { channel };

// Workers load this file again: they inherit the runner's env, so one key per run.
if (!process.env.E2E_BYOK_SEAL_FILE) {
  const file = join(mkdtempSync(join(tmpdir(), "lk-byok-")), "seal.key");
  writeFileSync(file, randomBytes(32).toString("base64"), { mode: 0o600 });
  process.env.E2E_BYOK_SEAL_FILE = file;
}

export default defineConfig({
  testDir: ".",
  testMatch: ["byok/**/*.spec.mjs"],
  outputDir: "test-results-byok",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
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
      name: "byok",
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
        BYOK_ENABLED: "true",
        BYOK_SEAL_KEY_FILE: process.env.E2E_BYOK_SEAL_FILE,
        PORT: String(WEB_PORT),
      },
      url: baseURL,
      // Never another server on this port: it may run with the flag off.
      reuseExistingServer: false,
      timeout: 600_000,
    },
  ],
});
