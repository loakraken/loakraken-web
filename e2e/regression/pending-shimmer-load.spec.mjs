// 회귀(#900·#904, '집계 중' 빛 띠의 프레임 비용): 칸 40개가 같이 빛나도 CPU 4배 감속에서 3초 동안 긴 작업(50ms
// 초과) 0. 이 측정은 다른 테스트와 CPU를 다투면 페이지와 무관한 긴 작업을 잡는다(develop 같은 빌드에서 혼자
// 10회 0회 실패, 셋이 동시에 10회 1회 실패 — #941). 그래서 이 파일만 'solo' 프로젝트로, 다른 테스트가 모두
// 끝난 뒤 혼자 돈다(playwright.config.mjs). 기준 50ms는 그대로다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

// DIAGNOSTIC (to be reverted): 8 runs in one CI job, no retry (#941).
test.describe.configure({ retries: 0 });
for (let run = 1; run <= 8; run += 1)
test(`@집계중 칸 40개가 같이 빛나도 긴 작업 0, CPU 4배 감속 #${run} @regression`, async ({ page }, testInfo) => {
  // 40 labels on screen at once (transform only, still a layer each), the CPU
  // slowed down 4×, 3 s of frames and long tasks.
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
  // Chrome re-styles every running animation on each main frame (this rAF loop
  // makes one per frame): two animations a label on a pseudo-element gave long
  // tasks of 50–100 ms here on CI (#900). A failure says when, and what was fetched.
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  const m = await page.evaluate(
    () =>
      new Promise((done) => {
        const tasks = [];
        const observer = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) tasks.push(`${Math.round(e.startTime)}+${Math.round(e.duration)}`);
        });
        observer.observe({ type: "longtask" });
        let frames = 0;
        const start = document.timeline.currentTime;
        const tick = () => {
          frames += 1;
          if (document.timeline.currentTime - start < 3000) requestAnimationFrame(tick);
          else {
            observer.disconnect();
            // For the failure message: what the page fetched in the window.
            const fetched = performance
              .getEntriesByType("resource")
              .filter((r) => r.startTime >= start)
              .map((r) => `${Math.round(r.startTime)} ${new URL(r.name).pathname}`);
            done({ longTasks: tasks.length, tasks: tasks.join(" "), fetched: fetched.join(" | "), from: Math.round(start), fps: Math.round((frames / 3) * 10) / 10 });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  testInfo.annotations.push({ type: "perf", description: `40칸 CPU×4: 긴 작업 ${m.longTasks}, ${m.fps}fps` });
  console.log(`SHIMMER-PERF longTasks ${m.longTasks} fps ${m.fps} from ${m.from} tasks ${m.tasks} fetched ${m.fetched}`);
  expect(await page.locator("[data-probe] [data-slot=pending-text]").count()).toBe(40);
  expect(m.longTasks, `긴 작업(50ms 초과) ${m.tasks} — 그동안 받은 것: ${m.fetched}`).toBe(0);
});
