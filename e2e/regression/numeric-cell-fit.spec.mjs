// 회귀(A37, 11-16): 좁은 화면에서 숫자 칸 글자가 제 칸을 넘었다. 320에서 사이트 글꼴로도 통계 탭 현재·최고·변화
// ('1,780.83' 5px, '▲580.29' 6px), 원정대 탭 주간 골드('289,000G' 11.7px), 레이드 보상 표('11,500G' 4.5px).
// 400px 아래에서는 첫 값이 한 줄을 다 쓰고 나머지 둘이 다음 줄을 나누며, 레이드 표는 골드 칸 왼쪽 틈을 줄인다.
// 숫자는 줄이지 않는다(PM 총괄 11-16).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const ROUTES = [characterPath("상세", "stats"), characterPath("상세", "siblings"), "/tools/raid-rewards"];

for (const width of [320, 360, 399, 400])
  test(`${width}px: 통계·주간 골드·레이드 보상의 숫자가 제 칸 안 @A37 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const overflows = [];
    for (const path of ROUTES) {
      await gotoReady(page, path);
      // Measured with whichever face this visit settled on (the site font is display:optional).
      await page.evaluate(() => document.fonts.ready);
      const found = await page.evaluate(() => {
        const out = [];
        for (const el of document.querySelectorAll("main th, main td, main dd")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || el.closest("[hidden],[aria-hidden=true]")) continue;
          const box = el.getBoundingClientRect();
          if (box.width <= 2) continue;
          let over = 0;
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          for (let n = walker.nextNode(); n; n = walker.nextNode()) {
            if (!n.textContent.trim()) continue;
            const ps = getComputedStyle(n.parentElement);
            if (ps.display === "none" || ps.visibility === "hidden" || /(absolute|fixed)/.test(ps.position)) continue;
            const range = document.createRange();
            range.selectNodeContents(n);
            for (const r of range.getClientRects()) if (r.width > 0) over = Math.max(over, box.left - r.left, r.right - box.right);
          }
          if (over > 0.5) out.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().replace(/\s+/g, " ").slice(0, 20)}" ${over.toFixed(1)}px`);
        }
        return out;
      });
      for (const f of found) overflows.push(`${decodeURIComponent(path)}: ${f}`);
    }
    expect(overflows, "제 칸을 넘은 숫자").toEqual([]);
  });
