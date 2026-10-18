// 진단(#900, 판정 뒤 되돌림): 실제 40칸 검사(rAF 루프, CPU x4, 3초, 긴 작업 0)를
// 후보 설계마다 8번. CI 러너에서 후보별 통과 수와 긴 작업 시간을 보려는 것.
// current: as shipped (2 animations/label, glow on ::before).
// span: 2 animations/label, glow on a real span.
// one: 1 animation/label (the window only; looks wrong, measures the count).
// band: 1 animated element/label: bright text, a wide dim layer with a clear band moved by transform.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test.use({ bypassCSP: true });

const CSS = {
  current: "",
  span: `.pending-text__window::before{content:none!important;animation:none!important}
         .zz-glow{position:absolute;inset:0 auto 0 0;white-space:nowrap;color:var(--foreground);animation:pending-text-glow 1.5s linear infinite;will-change:transform}`,
  one: `.pending-text__window::before{animation:none!important}`,
  band: `.pending-text{overflow:hidden;color:var(--foreground)!important}
         .pending-text__window::before{content:none!important;animation:none!important}
         .pending-text__window{inset:0 auto 0 0!important;width:300%!important;mask-image:none!important;
           background:linear-gradient(90deg,var(--background) 0 40%,transparent 47% 53%,var(--background) 60% 100%)!important;
           opacity:.55;animation:zz-band 1.5s linear infinite!important}
         @keyframes zz-band{from{transform:translateX(-66.66%)}to{transform:translateX(0)}}`,
};

for (const mode of Object.keys(CSS))
  for (let run = 0; run < 8; run += 1)
    test(`@진단 집계중 후보 ${mode} ${run} @regression`, async ({ page }) => {
      const cdp = await page.context().newCDPSession(page);
      await gotoReady(page, "/market/gems");
      if (CSS[mode]) await page.addStyleTag({ content: CSS[mode] });
      const label = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" }).locator('[data-slot="pending-text"]');
      await expect(label).toHaveText("집계 중");
      await label.evaluate((el, span) => {
        const box = document.createElement("div");
        box.setAttribute("data-probe", "");
        box.style.cssText = "display:grid;grid-template-columns:repeat(8,auto);gap:8px;padding:8px";
        for (let i = 0; i < 40; i += 1) box.append(el.cloneNode(true));
        el.closest("table").before(box);
        if (span)
          for (const w of document.querySelectorAll(".pending-text__window")) {
            const s = document.createElement("span");
            s.className = "zz-glow";
            s.textContent = w.dataset.glow;
            w.append(s);
          }
      }, mode === "span");
      await page.route("**/api/**", () => {});
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
      console.log(`VARIANT ${mode} ${run} long ${m.long} [${m.tasks}] fps ${m.fps}`);
      expect(m.long, `후보 ${mode}: 긴 작업 [${m.tasks}]ms, ${m.fps}fps`).toBe(0);
    });
