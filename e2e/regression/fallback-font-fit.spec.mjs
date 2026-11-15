// 회귀(A37, PM 총괄 11-16): 사이트 글꼴(Kraken Sans)은 display:optional이라, 받기 대기 시간을 놓친 방문은
// 그 방문 내내 시스템 글꼴로 그린다. 시스템 글꼴은 더 넓어(Windows Malgun Gothic 한글 +18%, 리눅스 DejaVu Sans
// 숫자 +10%·WenQuanYi Zen Hei 한글 +17%) 표·배지·머리글이 칸을 넘었고, 그래서 globals.css에 너비를 맞춘 대체
// 글꼴(Kraken Fallback Win·Linux)을 둔다. 여기서는 사이트 글꼴 파일을 막고, 11-16에 넘쳤던 화면에서 칸·머리글·
// 버튼·요약 글자가 제 상자를 넘지 않는지 본다. CI 러너(리눅스)에서는 리눅스 대체 글꼴을, Windows에서는 Windows
// 것을 재는 셈이다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

// The aborted font file logs a failed request; that is the point of the test.
test.use({ allowConsoleErrors: true });

const ROUTES = [
  "/",
  characterPath("상세", "stats"),
  characterPath("상세", "siblings"),
  "/stats/classes/" + encodeURIComponent("블레이드"),
  "/rankings?type=guilds",
  "/market/gems",
  "/tools/raid-rewards",
  "/tools/loa-shop",
  "/tools/abidos-craft",
  "/tools/combat-power",
];

for (const width of [320, 360])
  test(`${width}px: 사이트 글꼴을 못 받은 방문에서도 칸·머리글·버튼 글자가 제 상자 안 @A37 @regression`, async ({ page }) => {
    test.setTimeout(240_000);
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/*.woff2", (route) => route.abort());
    const overflows = [];
    for (const path of ROUTES) {
      await gotoReady(page, path);
      // The site font really is absent (a served file would hide what this guards).
      expect(await page.evaluate(() => [...document.fonts].some((f) => f.status === "loaded" && /kraken/i.test(f.family))), path).toBe(false);
      const found = await page.evaluate(() => {
        const out = [];
        if (document.documentElement.scrollWidth > innerWidth + 1) out.push(`가로 스크롤 ${document.documentElement.scrollWidth}>${innerWidth}`);
        for (const el of document.querySelectorAll("main th, main td, main button, main summary, main dd, main [class*=Badge]")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden" || el.closest("[hidden],[aria-hidden=true]")) continue;
          if (el.clientWidth <= 2 || /(auto|scroll)/.test(cs.overflowX)) continue;
          if (el.scrollWidth > el.clientWidth + 1)
            out.push(`${el.tagName.toLowerCase()} "${el.textContent.trim().replace(/\s+/g, " ").slice(0, 20)}" ${el.scrollWidth}>${el.clientWidth}`);
        }
        return out;
      });
      for (const f of found) overflows.push(`${decodeURIComponent(path)}: ${f}`);
    }
    expect(overflows, "대체 글꼴에서 제 상자를 넘은 글자").toEqual([]);
  });
