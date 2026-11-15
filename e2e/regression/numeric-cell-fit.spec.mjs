// 회귀(A37, 11-16): 좁은 화면에서 숫자 칸 글자가 제 칸을 넘었다. 320에서 사이트 글꼴로도 통계 탭 현재·최고·변화
// ('1,780.83' 5px, '▲580.29' 6px), 원정대 탭 주간 골드('289,000G' 11.7px), 레이드 보상 표('11,500G' 4.5px).
// 400px 아래에서는 첫 값이 한 줄을 다 쓰고 나머지 둘이 다음 줄을 나누며, 레이드 표는 골드 칸 왼쪽 틈을 줄인다.
// 숫자는 줄이지 않는다(PM 총괄 11-16).
// 글꼴이 정해진 채로 잰다(#1747 리뷰 P2): 사이트 글꼴은 display:optional이라 한 방문이 대기 시간을 놓치면 시스템
// 글꼴로 남고, CI에서 그 차이로 결과가 뒤집힐 수 있었다. 그래서 (1) 사이트 글꼴을 먼저 받아 두고 쓰이는지 확인한 뒤,
// (2) 넓은 시스템 글꼴(DejaVu Sans, 없으면 Verdana)을 모든 글자에 입혀 각각 잰다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const ROUTES = [characterPath("상세", "stats"), characterPath("상세", "siblings"), "/tools/raid-rewards"];
const WIDE = `
  @font-face { font-family: "WideFallback"; src: local("DejaVu Sans"), local("DejaVuSans"), local("Verdana"); font-weight: 400; }
  @font-face { font-family: "WideFallback"; src: local("DejaVu Sans Bold"), local("DejaVuSans-Bold"), local("Verdana Bold"), local("Verdana-Bold"); font-weight: 700; }
  html, body, body * { font-family: "WideFallback", "Malgun Gothic", "Noto Sans CJK KR", "WenQuanYi Zen Hei", sans-serif !important; }`;

/** Text drawn past its own th/td/dd box, per element (text rects, so a ::after hit area never counts). */
const overflowsIn = (page) =>
  page.evaluate(() => {
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

for (const width of [320, 360, 399, 400])
  test(`${width}px 사이트 글꼴: 통계·주간 골드·레이드 보상의 숫자가 제 칸 안 @A37 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // The site font in the cache first, so every page below draws with it inside its short wait.
    await gotoReady(page, "/");
    await page.evaluate(() => Promise.all([document.fonts.load("15px kraken"), document.fonts.load("700 15px kraken")]));
    const overflows = [];
    for (const path of ROUTES) {
      await gotoReady(page, path);
      // A face can be "loaded" yet unused: display:optional keeps a page on the system face when the file
      // came late. So draw the same text in the page's stack and in the site font alone (else the browser
      // default, far from both fallbacks); equal widths mean the page draws with the site font now.
      const drawn = await page.evaluate(async () => {
        await document.fonts.ready;
        const probe = (family) => {
          const span = document.createElement("span");
          span.textContent = "가나다 1,780.83G";
          Object.assign(span.style, { position: "absolute", visibility: "hidden", whiteSpace: "nowrap", fontSize: "15px", fontWeight: "700" });
          if (family) span.style.fontFamily = family;
          document.querySelector("main").append(span);
          const width = span.getBoundingClientRect().width;
          span.remove();
          return width;
        };
        return { stack: probe(""), site: probe("kraken") };
      });
      expect(Math.abs(drawn.stack - drawn.site), `${decodeURIComponent(path)}: 사이트 글꼴로 그렸다 ${JSON.stringify(drawn)}`).toBeLessThan(0.01);
      for (const f of await overflowsIn(page)) overflows.push(`${decodeURIComponent(path)}: ${f}`);
    }
    expect(overflows, "제 칸을 넘은 숫자").toEqual([]);
  });

for (const width of [320, 360, 399])
  test(`${width}px 넓은 시스템 글꼴: 통계·주간 골드·레이드 보상의 숫자가 제 칸 안 @A37 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript((css) => {
      const style = document.createElement("style");
      style.textContent = css;
      document.addEventListener("DOMContentLoaded", () => document.head.append(style));
    }, WIDE);
    const overflows = [];
    for (const path of ROUTES) {
      await gotoReady(page, path);
      const used = await page.evaluate(async () => {
        await Promise.all([document.fonts.load("15px WideFallback"), document.fonts.load("700 15px WideFallback")]);
        await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        return [...document.fonts].some((f) => f.family.replace(/["']/g, "") === "WideFallback" && f.status === "loaded");
      });
      expect(used, `${decodeURIComponent(path)}: 넓은 대체 글꼴(DejaVu Sans·Verdana)이 이 기기에 있어 실제로 쓰였다`).toBe(true);
      for (const f of await overflowsIn(page)) overflows.push(`${decodeURIComponent(path)}: ${f}`);
    }
    expect(overflows, "넓은 글꼴에서 제 칸을 넘은 숫자").toEqual([]);
  });
