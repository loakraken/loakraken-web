// 진단(#900, 판정 뒤 되돌림): 고른 설계(빛 사본을 실제 요소로 옮김)를 실제 40칸 검사
// (rAF 루프, CPU x4, 3초, 긴 작업 0)로 CI 러너에서 8번. 후보 비교(이전 커밋)에서
// 지금 판 3/8, 빛 사본 span 8/8이었다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

for (let run = 0; run < 8; run += 1)
  test(`@진단 집계중 고른 설계 ${run} @regression`, async ({ page }) => {
    const cdp = await page.context().newCDPSession(page);
    await gotoReady(page, "/market/gems");
    const label = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" }).locator('[data-slot="pending-text"]');
    await expect(label).toHaveText("집계 중");
    await label.evaluate((el) => {
      const box = document.createElement("div");
      box.style.cssText = "display:grid;grid-template-columns:repeat(8,auto);gap:8px;padding:8px";
      for (let i = 0; i < 40; i += 1) box.append(el.cloneNode(true));
      el.closest("table").before(box);
    });
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
    const m = await page.evaluate(
      () =>
        new Promise((done) => {
          const tasks = [];
          const observer = new PerformanceObserver((list) => {
            for (const e of list.getEntries()) tasks.push(Math.round(e.duration));
          });
          observer.observe({ type: "longtask" });
          let frames = 0;
          const start = document.timeline.currentTime;
          const tick = () => {
            frames += 1;
            if (document.timeline.currentTime - start < 3000) requestAnimationFrame(tick);
            else {
              observer.disconnect();
              done({ tasks: tasks.join(","), long: tasks.length, fps: Math.round((frames / 3) * 10) / 10 });
            }
          };
          requestAnimationFrame(tick);
        }),
    );
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
    console.log(`VARIANT impl ${run} long ${m.long} [${m.tasks}] fps ${m.fps}`);
    expect(m.long, `고른 설계: 긴 작업 [${m.tasks}]ms, ${m.fps}fps`).toBe(0);
  });
