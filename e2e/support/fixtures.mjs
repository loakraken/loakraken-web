// Shared test fixture.
// - Hermetic network: only the local app and mock backend are reachable.
//   External images (official CDN icons) get a 1x1 PNG, anything else is aborted.
// - Console errors and uncaught page errors fail the test unless the test
//   opts out with `test.use({ allowConsoleErrors: true })`.
import { test as base, expect } from "@playwright/test";

const PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);
const LOCAL_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const isLocal = (url) => LOCAL_HOSTS.has(new URL(url).hostname);

export const test = base.extend({
  allowConsoleErrors: [false, { option: true }],

  page: async ({ page, allowConsoleErrors }, provide, testInfo) => {
    await page.route(
      (url) => !isLocal(url.href),
      (route) =>
        route.request().resourceType() === "image"
          ? route.fulfill({ contentType: "image/png", body: PIXEL })
          : route.abort(),
    );
    const errors = [];
    page.on("console", (message) => {
      if (message.type() !== "error") return;
      const source = message.location().url;
      // Blocked third-party requests are expected noise, not app errors.
      if (source && !isLocal(source)) return;
      // The browser logs every 4xx/5xx fetch. Error-flow tests trigger those on
      // purpose and assert the visible message instead.
      if (
        source &&
        message.text().startsWith("Failed to load resource: the server responded with a status of") &&
        new URL(source).pathname.startsWith("/api/")
      )
        return;
      errors.push(message.text());
    });
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));

    await provide(page);

    if (errors.length)
      await testInfo.attach("console-errors", { body: errors.join("\n"), contentType: "text/plain" });
    if (!allowConsoleErrors)
      expect(errors, "브라우저 콘솔 오류가 없어야 한다").toEqual([]);
  },
});

export { expect };

export const characterPath = (name, tab) =>
  `/character/${encodeURIComponent(name)}${tab && tab !== "combat" ? `?tab=${tab}` : ""}`;

/** Fails when the page scrolls sideways (layout wider than the viewport). */
export async function expectNoHorizontalOverflow(page) {
  const { scroll, client } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(scroll, "가로 스크롤이 생기지 않아야 한다").toBeLessThanOrEqual(client);
}

// Phrases that only appear when a response failed contract validation.
export const CONTRACT_FAILURE = /응답 형식이 예상과 달라|조회 결과를 확인할 수 없어요/;
