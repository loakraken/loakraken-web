// 회귀(사용자 결정 10-16·10-18, '집계 중' 동적 표시): 아직 못 읽은 칸의 '집계 중…'은 글자 위 빛 띠(1.5초)가
// 값이 올 때까지 계속 돈다(로딩 표시라 5초 규칙 예외). transform만 움직이고(칠하기 없음), 칸이 몇 개든 같은
// 박자, 화면 밖이면 멈췄다가 돌아오면 같은 박자로, 글자 상자는 그대로(A7, '…'는 처음부터), 동작 줄이기면
// 정지, 칸마다 따로 읽지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const read = (label) =>
  label.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      animations: el.getAnimations({ subtree: true }).map((a) => ({
        start: a.startTime,
        state: a.playState,
        duration: a.effect.getTiming().duration,
        iterations: a.effect.getComputedTiming().iterations,
        // Only transforms move (no repaint per frame).
        props: [...new Set(a.effect.getKeyframes().flatMap((k) => Object.keys(k)))].filter((p) => !["offset", "easing", "composite", "computedOffset"].includes(p)),
      })),
      box: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10),
      after: getComputedStyle(el, "::after").content,
      paused: el.hasAttribute("data-paused"),
      role: el.getAttribute("role"),
      live: el.closest("[aria-live]") === el,
    };
  });
const RUNNING = { start: 0, state: "running", duration: 1500, iterations: Infinity, props: ["transform"] };

for (const width of [1280, 360])
  test(`@집계중 ${width} 빛 띠 1.5초 계속·transform만·같은 박자·상자 그대로, 칸마다 읽지 않음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__shifts.push(entry.value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    await gotoReady(page, "/market/gems");
    const board = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" });
    const label = board.locator('[data-slot="pending-text"]');
    await expect(label).toHaveText("집계 중");
    // The window and its brighter copy: 1.5 s, on and on, on the shared beat (start 0).
    await expect.poll(async () => (await read(label)).animations).toEqual([RUNNING, RUNNING]);
    const first = await read(label);
    expect(first.after, "'…'는 처음부터").toMatch(/^"…"/);
    expect(first.role, "자기 역할 없음").toBeNull();
    expect(first.live, "자기 알림 없음").toBe(false);
    // The brighter copy is drawn for the eye only: the cell is named "집계 중"
    // once in the accessibility tree, not twice (#900 review).
    const cell = await label.locator("xpath=ancestor::td[1]").ariaSnapshot();
    expect(cell.match(/집계 중/g) ?? [], `접근성 트리에 한 번: ${cell}`).toHaveLength(1);
    const before = await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0));
    await page.waitForTimeout(800);
    expect((await read(label)).box, "글자 상자 그대로").toEqual(first.box);
    // Past 5 s it still runs: a loading sign until the value comes.
    await page.waitForTimeout(4_500);
    expect((await read(label)).animations.map((a) => a.state)).toEqual(["running", "running"]);
    expect(await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0)), "흔들림").toBe(before);
  });

test("@집계중 화면 밖이면 멈추고, 돌아오면 같은 박자로 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await gotoReady(page, "/market/gems");
  const label = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" }).locator('[data-slot="pending-text"]');
  await label.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await read(label)).paused).toBe(false);
  // Out of view: paused.
  await page.evaluate(() => window.scrollTo(0, 0));
  await expect.poll(async () => (await read(label)).paused).toBe(true);
  expect((await read(label)).animations.map((a) => a.state)).toEqual(["paused", "paused"]);
  // Back: running again, on the beat.
  await label.scrollIntoViewIfNeeded();
  await expect.poll(async () => (await read(label)).animations).toEqual([RUNNING, RUNNING]);
});
test("@집계중 동작 줄이기면 정지 글자 '집계 중…' @regression", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoReady(page, "/market/gems");
  const label = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" }).locator('[data-slot="pending-text"]');
  await expect(label).toHaveText("집계 중");
  const still = await read(label);
  expect(still.animations, "움직임 없음").toEqual([]);
  expect(still.after, "말줄임표로 진행 중임을 알림").toMatch(/^"…"/);
});

test("@집계중 강제 색상(고대비)에서는 빛 띠 없이 보이는 글자 @regression", async ({ page }) => {
  await page.emulateMedia({ forcedColors: "active" });
  await gotoReady(page, "/market/gems");
  const label = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" }).locator('[data-slot="pending-text"]');
  await expect(label).toHaveText("집계 중");
  expect((await read(label)).animations).toEqual([]);
  const fill = await label.evaluate((el) => getComputedStyle(el).webkitTextFillColor);
  expect(fill, "글자가 투명하지 않음").not.toMatch(/rgba\(0, 0, 0, 0\)|transparent/);
});

test("@집계중 장신구판도 같은 부품 @regression", async ({ page }) => {
  await gotoReady(page, "/market/accessories");
  const label = page.getByRole("region", { name: /^반지/ }).locator('[data-slot="pending-text"]');
  await expect(label).toHaveText("집계 중");
  await expect.poll(async () => (await read(label)).animations).toEqual([RUNNING, RUNNING]);
});
