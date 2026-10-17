// 회귀(사용자 확정 10-16, '집계 중' 동적 표시): 아직 못 읽은 칸의 '집계 중'은 글자 위 빛 띠(1.5초 반복).
// 칸이 몇 개든 같은 박자(문서 시간 기준), 글자 상자는 그대로(A7 흔들림 0), 동작 줄이기면 정지 글자
// '집계 중…', 칸마다 따로 읽지 않는다(자기 역할·알림 없음).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const read = (label) =>
  label.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      animations: el.getAnimations().map((a) => ({ start: a.startTime, duration: a.effect.getTiming().duration })),
      box: [r.x, r.y, r.width, r.height].map((n) => Math.round(n * 10) / 10),
      after: getComputedStyle(el, "::after").content,
      role: el.getAttribute("role"),
      live: el.closest("[aria-live]") === el,
    };
  });

for (const width of [1280, 360])
  test(`@집계중 ${width} 빛 띠 1.5초·같은 박자·상자 그대로, 칸마다 읽지 않음 @regression`, async ({ page }) => {
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
    // One loop of 1.5 s, started at the document's time origin: every label on
    // the page is at the same point of the band whenever it was drawn.
    await expect.poll(async () => (await read(label)).animations).toEqual([{ start: 0, duration: 1500 }]);
    const first = await read(label);
    expect(first.role, "자기 역할 없음").toBeNull();
    expect(first.live, "자기 알림 없음").toBe(false);
    // Only the paint moves: the box is the same half a loop later, and nothing shifts.
    const before = await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0));
    await page.waitForTimeout(800);
    expect((await read(label)).box, "글자 상자 그대로").toEqual(first.box);
    expect(await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0)), "흔들림").toBe(before);
  });

test("@집계중 동작 줄이기면 정지 글자 '집계 중…' @regression", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoReady(page, "/market/gems");
  const label = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" }).locator('[data-slot="pending-text"]');
  await expect(label).toHaveText("집계 중");
  const still = await read(label);
  expect(still.animations, "움직임 없음").toEqual([]);
  expect(still.after, "말줄임표로 진행 중임을 알림").toBe('"…"');
});

test("@집계중 칸 40개가 같이 빛나도 긴 작업 0, CPU 4배 감속 @regression", async ({ page }, testInfo) => {
  // The paint is the cost (background-position each frame): 40 labels on
  // screen at once, the CPU slowed down 4×, 3 s of frames and long tasks.
  const cdp = await page.context().newCDPSession(page);
  await gotoReady(page, "/market/gems");
  const board = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" });
  const label = board.locator('[data-slot="pending-text"]');
  await expect(label).toHaveText("집계 중");
  await label.evaluate((el) => {
    const box = document.createElement("div");
    box.setAttribute("data-probe", "");
    box.style.cssText = "display:grid;grid-template-columns:repeat(8,auto);gap:8px;padding:8px";
    for (let i = 0; i < 40; i += 1) box.append(el.cloneNode(true));
    el.closest("table").before(box);
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const m = await page.evaluate(
    () =>
      new Promise((done) => {
        let longTasks = 0;
        const observer = new PerformanceObserver((list) => (longTasks += list.getEntries().length));
        observer.observe({ type: "longtask" });
        let frames = 0;
        const start = document.timeline.currentTime;
        const tick = () => {
          frames += 1;
          if (document.timeline.currentTime - start < 3000) requestAnimationFrame(tick);
          else {
            observer.disconnect();
            done({ longTasks, fps: Math.round((frames / 3) * 10) / 10 });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  testInfo.annotations.push({ type: "perf", description: `40칸 CPU×4: 긴 작업 ${m.longTasks}, ${m.fps}fps` });
  console.log(`SHIMMER-PERF longTasks ${m.longTasks} fps ${m.fps}`);
  expect(await page.locator("[data-probe] [data-slot=pending-text]").count()).toBe(40);
  expect(m.longTasks, "긴 작업(50ms 초과)").toBe(0);
});

test("@집계중 장신구판도 같은 부품 @regression", async ({ page }) => {
  await gotoReady(page, "/market/accessories");
  const label = page.getByRole("region", { name: /^반지/ }).locator('[data-slot="pending-text"]');
  await expect(label).toHaveText("집계 중");
  await expect.poll(async () => (await read(label)).animations).toEqual([{ start: 0, duration: 1500 }]);
});
