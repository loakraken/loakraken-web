// 회귀(#1131): 첫 화면 320·360에서 소개 영역의 궤도 고리(266px 사각 상자가 계속 돎)가 돌면서
// 상자 폭이 커져 몇 초 뒤 화면이 옆으로 1~5px 넘쳤다. 처음 몇 초 동안 계속 재도 넘침 0.
import { test, expect } from "../support/fixtures.mjs";

test.use({ hasTouch: true });

for (const width of [320, 360])
  test(`첫 화면 ${width}: 궤도가 돌아도 가로 넘침 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.addInitScript(() => {
      window.__widest = 0;
      const timer = setInterval(() => {
        const doc = document.documentElement;
        window.__widest = Math.max(window.__widest, doc.scrollWidth - doc.clientWidth);
      }, 100);
      setTimeout(() => clearInterval(timer), 6000);
    });
    await page.goto("/", { waitUntil: "load" });
    // The outer ring turns once in 26 s; it crossed the edge from about 3 s in.
    await page.waitForTimeout(5500);
    expect(await page.evaluate(() => window.__widest), "처음 몇 초 동안 가장 넓은 가로 넘침(px)").toBe(0);
  });
