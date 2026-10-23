// QA team Playwright config. Runs against the synthetic mock backend only:
// no Lost Ark API and no OpenAI calls. Ports are in the QA range (3200s).
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";

// E2E_SERVER=standalone runs the production build (next build + standalone
// server.js, like the container image) instead of `next dev`. It uses its own
// default port so it never collides with a dev server left running on 3200.
const standalone = process.env.E2E_SERVER === "standalone";
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? (standalone ? 3202 : 3200));
const MOCK_PORT = Number(process.env.E2E_MOCK_PORT ?? 3201);
// CHARACTER_INDEXING on (off by default) so the search-bot path is covered;
// PRICE_ALERTS on (off by default) so the alerts page and routes are;
// DEV_NOTES_DIR: test notes instead of the published ones (an absolute path:
// the standalone server runs from its own folder).
const api = {
  LOAKRAKEN_API_ORIGIN: `http://127.0.0.1:${MOCK_PORT}`,
  CHARACTER_INDEXING: "on",
  PRICE_ALERTS: "on",
  DEV_NOTES_DIR: fileURLToPath(new URL("./support/dev-notes", import.meta.url)),
};
// E2E_BASE_URL points the suite at an already running preview (e.g. a PR
// worktree on another port). The servers below are then not started.
const external = process.env.E2E_BASE_URL;
const baseURL = external ?? `http://127.0.0.1:${WEB_PORT}`;
// Locally the installed Chrome is used so no browser download is needed.
// CI can set E2E_CHANNEL=chromium after `npx playwright install chromium`.
const channel = process.env.E2E_CHANNEL ?? "chrome";
const browser = channel === "chromium" ? {} : { channel };

// Specs that arm the shared mock failure queue (POST /__fail).
const ISOLATED = ["regression/mock-failures.spec.mjs"];
// Measurements of main-thread time under a CPU slowdown: run alone, after
// every other project, so another worker's page never takes the CPU (#941).
const SOLO = ["regression/pending-shimmer-load.spec.mjs"];

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
      testIgnore: [...ISOLATED, ...SOLO],
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 1440, height: 900 } },
    },
    {
      name: "tablet-768",
      grep: /@smoke/,
      testIgnore: [...ISOLATED, ...SOLO],
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: false },
    },
    {
      name: "mobile-390",
      grep: /@smoke/,
      testIgnore: [...ISOLATED, ...SOLO],
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false },
    },
    // 목 실패 장치(/__fail)는 목 전체가 공유한다. 다른 테스트와 동시에 돌면 서로의 실패 예약을
    // 소모·삭제하므로, 다른 프로젝트가 모두 끝난 뒤 이 프로젝트만 혼자 돈다.
    {
      name: "isolated",
      testMatch: ISOLATED,
      dependencies: ["desktop-1440", "tablet-768", "mobile-390"],
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 1440, height: 900 } },
    },
    // One file, its tests one after another, after "isolated" (itself after the rest).
    {
      name: "solo",
      testMatch: SOLO,
      dependencies: ["isolated"],
      fullyParallel: false,
      use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 1440, height: 900 } },
    },
    // Performance budget (작업 규칙 "성능 우선"): opt-in with E2E_PERF=1, mobile size.
    ...(process.env.E2E_PERF === "1"
      ? [
          {
            name: "perf",
            testMatch: ["perf/**/*.spec.mjs"],
            retries: 0,
            // 한 파일 안에서는 차례로 잰다(측정끼리 CPU를 다투지 않게). serial 모드가 아니라서
            // ENFORCE로 한 화면이 실패해도 나머지 화면은 계속 잰다(배포·운영 #197 지적).
            fullyParallel: false,
            use: { ...devices["Desktop Chrome"], ...browser, viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: false, trace: "off" },
          },
        ]
      : []),
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
