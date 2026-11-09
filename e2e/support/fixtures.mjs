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
      // Local Windows socket exhaustion under parallel runs, not an app error.
      if (message.text().includes("net::ERR_NO_BUFFER_SPACE")) return;
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

/**
 * Navigate and wait until the page is hydrated enough to take clicks: React
 * attaches handlers after the client bundle and first queries load. Clicking
 * before that (seen on CI with the dev server) silently does nothing.
 */
export async function gotoReady(page, path) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
}

/**
 * Picks an option from the shared Select (components/ui/select.tsx, Base UI):
 * it is a combobox button with a listbox popup, not a native <select>, so
 * selectOption does not apply. Opens the list and clicks the option by name.
 */
export async function chooseOption(page, combobox, name) {
  await combobox.click();
  await page.getByRole("option", { name, exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}

export const characterPath = (name, tab) =>
  `/character/${encodeURIComponent(name)}${tab && tab !== "combat" ? `?tab=${tab}` : ""}`;

/**
 * The spec-up tab on its candidate list (전투력 증가 chip): a dealer's first view
 * is 추천 순서 since 11-02 (layout A), and the chip lives in the address.
 */
export const specUpListPath = (name) => `${characterPath(name, "specup")}&sort=DELTA`;

/**
 * Fails when the page scrolls sideways (layout wider than the viewport).
 * The message names the deepest elements that stick out past the right edge,
 * so a CI failure (different fonts on Linux) points at the culprit.
 */
export async function expectNoHorizontalOverflow(page) {
  const { scroll, client, offenders } = await page.evaluate(() => {
    const client = document.documentElement.clientWidth;
    const describe = (el) => {
      const cls = typeof el.className === "string" ? el.className.split(/\s+/)[0] : "";
      const text = (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 30);
      return `${el.tagName.toLowerCase()}${cls ? `.${cls}` : ""} right=${Math.round(el.getBoundingClientRect().right)} "${text}"`;
    };
    // Content inside a scrolling or clipping box (e.g. a wide table wrapper) does not widen the page.
    const clipped = (el) => {
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement)
        if (getComputedStyle(a).overflowX !== "visible") return true;
      return false;
    };
    const wide = [...document.querySelectorAll("body *")].filter((el) => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.right > client + 1 && !clipped(el);
    });
    // Keep only the innermost offenders (no offending child of their own).
    const leaves = wide.filter((el) => !wide.some((other) => other !== el && el.contains(other)));
    return {
      scroll: document.documentElement.scrollWidth,
      client,
      offenders: leaves.slice(0, 5).map(describe),
    };
  });
  expect(scroll, `가로 스크롤이 생기지 않아야 한다. 넘친 요소: ${offenders.join(" | ") || "없음"}`).toBeLessThanOrEqual(client);
}

// Phrases that only appear when a response failed contract validation.
export const CONTRACT_FAILURE = /응답 형식이 예상과 달라|조회 결과를 확인할 수 없어요/;
