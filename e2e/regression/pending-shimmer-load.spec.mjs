// 회귀(#900·#904, '집계 중' 빛 띠의 프레임 비용): 칸 40개가 같이 빛나도 CPU 4배 감속에서 3초 동안 긴 작업(50ms
// 초과) 0. 이 측정은 다른 테스트와 CPU를 다투면 페이지와 무관한 긴 작업을 잡는다(develop 같은 빌드에서 혼자
// 10회 0회 실패, 셋이 동시에 10회 1회 실패 — #941). 그래서 이 파일만 'solo' 프로젝트로, 다른 테스트가 모두
// 끝난 뒤 혼자 돈다(playwright.config.mjs). 기준 50ms는 그대로다.
// 실패하면 그 3초의 긴 프레임(50ms 이상)이 무엇에 시간을 썼는지(LoAF: 스크립트, 스타일·배치 시작, 그리기 시작)를
// 함께 남긴다 — 원인을 찾기 위한 기록이고, 기준·다시 시도는 바뀌지 않는다(CI 1/38, 로컬은 메모리 부족에 휩쓸림).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test("@집계중 칸 40개가 같이 빛나도 긴 작업 0, CPU 4배 감속 @regression", async ({ page }, testInfo) => {
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
        // What each long frame spent its time on: script (who called it, from where), then style and layout,
        // then rendering. Only read when the check fails.
        const frames = [];
        const frameObserver = new PerformanceObserver((list) => {
          for (const e of list.getEntries()) {
            if (e.duration < 50) continue;
            const at = (t) => (t ? Math.round(t - e.startTime) : "-");
            const scripts = e.scripts
              .map((s) => `${s.invokerType}:${s.invoker}@${(s.sourceURL || "").split("/").pop()}${s.sourceFunctionName ? `#${s.sourceFunctionName}` : ""} ${Math.round(s.duration)}ms`)
              .join(", ");
            frames.push(`${Math.round(e.startTime)}+${Math.round(e.duration)} (막음 ${Math.round(e.blockingDuration)}, 스타일@${at(e.styleAndLayoutStart)}, 그리기@${at(e.renderStart)}, 스크립트[${scripts}])`);
          }
        });
        frameObserver.observe({ type: "long-animation-frame" });
        let count = 0;
        const start = document.timeline.currentTime;
        const tick = () => {
          count += 1;
          if (document.timeline.currentTime - start < 3000) requestAnimationFrame(tick);
          else {
            observer.disconnect();
            frameObserver.disconnect();
            // For the failure message: what the page fetched in the window.
            const fetched = performance
              .getEntriesByType("resource")
              .filter((r) => r.startTime >= start)
              .map((r) => `${Math.round(r.startTime)} ${new URL(r.name).pathname}`);
            done({
              longTasks: tasks.length,
              tasks: tasks.join(" "),
              longFrames: frames.join(" | "),
              fetched: fetched.join(" | "),
              from: Math.round(start),
              fps: Math.round((count / 3) * 10) / 10,
            });
          }
        };
        requestAnimationFrame(tick);
      }),
  );
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  testInfo.annotations.push({ type: "perf", description: `40칸 CPU×4: 긴 작업 ${m.longTasks}, ${m.fps}fps` });
  console.log(`SHIMMER-PERF longTasks ${m.longTasks} fps ${m.fps} from ${m.from} tasks ${m.tasks} frames ${m.longFrames} fetched ${m.fetched}`);
  expect(await page.locator("[data-probe] [data-slot=pending-text]").count()).toBe(40);
  expect(m.longTasks, `긴 작업(50ms 초과) ${m.tasks} — 긴 프레임: ${m.longFrames || "없음"} — 그동안 받은 것: ${m.fetched}`).toBe(0);
});
