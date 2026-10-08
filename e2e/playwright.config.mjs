// QA team Playwright config. Runs against the synthetic mock backend only:
// no Lost Ark API and no OpenAI calls. Ports are in the QA range (3200s).
import { defineConfig, devices } from "@playwright/test";

const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 3200);
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3201);
// E2E_BASE_URL points the suite at an already running preview (e.g. a PR
// worktree on another port). The servers below are then not started.
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? `http://127.0.0.1:${WEB_PORT}`;
// Locally the installed Chrome is used so no browser download is needed.
// CI can set E2E_CHANNEL=chromium after `npx playwright install chromium`.
const channel = process.env.E2E_CHANNEL ?? "chrome";
const browser = channel === "chromium" ? {} : { channel };

export default defineConfig({
  testDir: ".",
  testMatch: ["smoke/**/*.spec.mjs", "regression/**/*.spec.mjs"],
  outputDir: "test-results",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : 3,
  // The dev server compiles a route on its first hit.
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: "./support/global-setup.mjs",
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
      name: "desktop-1440",
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 1440, height: 900 } },
    },
    {
      name: "mobile-390",
      grep: /@smoke/,
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false },
    },
  ],
  webServer: external
    ? undefined
    : [
        {
          command: "node ../tests/mock-backend.mjs",
          env: { MOCK_PORT: String(MOCK_PORT) },
          url: `http://127.0.0.1:${MOCK_PORT}/__counts`,
          reuseExistingServer: !process.env.CI,
          timeout: 30_000,
        },
        {
          command: `npx next dev --port ${WEB_PORT} --hostname 127.0.0.1`,
          cwd: "..",
          env: { LOAKRAKEN_API_ORIGIN: `http://127.0.0.1:${MOCK_PORT}` },
          url: baseURL,
          reuseExistingServer: !process.env.CI,
          timeout: 180_000,
        },
      ],
});
