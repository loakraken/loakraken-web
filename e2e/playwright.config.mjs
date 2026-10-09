// QA team Playwright config. Runs against the synthetic mock backend only:
// no Lost Ark API and no OpenAI calls. Ports are in the QA range (3200s).
import { defineConfig, devices } from "@playwright/test";

// E2E_SERVER=standalone runs the production build (next build + standalone
// server.js, like the container image) instead of `next dev`. It uses its own
// default port so it never collides with a dev server left running on 3200.
const standalone = process.env.E2E_SERVER === "standalone";
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? (standalone ? 3202 : 3200));
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3201);
const api = { LOAKRAKEN_API_ORIGIN: `http://127.0.0.1:${MOCK_PORT}` };
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
      name: "tablet-768",
      grep: /@smoke/,
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: false },
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
        standalone
          ? {
              command: "node support/standalone-server.mjs",
              env: { ...api, PORT: String(WEB_PORT) },
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              timeout: 600_000, // includes `next build`
            }
          : {
              command: `npx next dev --port ${WEB_PORT} --hostname 127.0.0.1`,
              cwd: "..",
              env: api,
              url: baseURL,
              reuseExistingServer: !process.env.CI,
              timeout: 180_000,
            },
      ],
});
