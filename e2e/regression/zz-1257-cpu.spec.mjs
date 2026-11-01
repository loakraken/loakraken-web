// 진단 전용(병합 금지, #1257): CPU를 4배 느리게 해 첫 로드 흔들림을 재현하고, 움직인 요소의 전후 상자와
// 첫 그림·하이드레이션 시각을 실패 메시지에 남긴다.
import { test, expect } from "../support/fixtures.mjs";

const CASES = [
  { path: "/stats", width: 320 },
  { path: "/stats", width: 1280 },
  { path: "/rankings?type=gems", width: 1280 },
  { path: "/rankings?type=gems", width: 320 },
  { path: "/rankings?type=bracelets", width: 1280 },
  { path: "/rankings", width: 1280 },
];

for (const c of CASES)
  for (const theme of ["light", "dark"])
    for (const run of [1, 2])
      test(`진단 CPU×4 ${c.path} ${c.width} ${theme} #${run}`, async ({ page }) => {
        await page.setViewportSize({ width: c.width, height: 900 });
        await page.addInitScript((t) => {
          localStorage.setItem("loakraken-theme", t);
          window.__diag = [];
          const describe = (node) => {
            if (!node) return "?";
            const el = node.nodeType === 1 ? node : node.parentElement;
            if (!el) return "?";
            const path = [];
            for (let e = el; e && e !== document.body && path.length < 4; e = e.parentElement)
              path.push(`${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}${typeof e.className === "string" && e.className ? `.${e.className.split(" ")[0]}` : ""}`);
            return `${node.nodeType === 3 ? "#text<" : ""}${path.join("<")} "${(el.textContent || "").trim().slice(0, 20)}"`;
          };
          const rect = (r) => r && [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
          new PerformanceObserver((list) => {
            for (const e of list.getEntries())
              window.__diag.push({ t: Math.round(e.startTime), v: +e.value.toFixed(5),
                sources: (e.sources || []).map((s) => ({ node: describe(s.node), from: rect(s.previousRect), to: rect(s.currentRect) })) });
          }).observe({ type: "layout-shift", buffered: true });
          new PerformanceObserver((list) => {
            for (const e of list.getEntries()) window.__diag.push({ t: Math.round(e.startTime), paint: e.name });
          }).observe({ type: "paint", buffered: true });
          // 하이드레이션 끝 ≈ 머리글에 React 연결이 붙는 시각.
          const iv = setInterval(() => {
            const el = document.querySelector("header");
            if (el && Object.keys(el).some((k) => k.startsWith("__reactFiber"))) {
              window.__diag.push({ t: Math.round(performance.now()), hydrated: true });
              clearInterval(iv);
            }
          }, 5);
        }, theme);
        const cdp = await page.context().newCDPSession(page);
        await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
        await page.goto(c.path, { waitUntil: "load" });
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(2500);
        const diag = await page.evaluate(() => window.__diag);
        const sum = +diag.filter((d) => d.v != null).reduce((a, d) => a + d.v, 0).toFixed(4);
        expect(sum, `DIAG ${JSON.stringify(diag)}`).toBe(0);
      });
