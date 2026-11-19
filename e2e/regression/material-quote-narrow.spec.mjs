// 회귀(v0.3.2 P2): 320에서 재료 구매 견적 본문이 26px 가로로 넘쳤다(카드를 담는 grid 열이 자동 크기라
// 이름 입력칸의 기본 폭 300px만큼 카드가 넓어짐). 320·360·390·1280에서 가로 넘침 0, 카드는 화면 안
// (넓은 화면도 입력칸 폭 규칙이 바뀐 뒤 넘치지 않는지 함께 본다).
// 또 '가격 기준' 칸은 한 줄이 들어가지 않는 폭(320)에서 처음 HTML부터 세로라, 글꼴이 온 뒤 접히며
// 아래를 미는 일이 없다(첫 로드 흔들림 0, 측정 0.1216에서 발견).
import { test, expect, gotoReady, expectNoHorizontalOverflow, fixtureIgnoresConsole } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";
import { drawnFace } from "../support/fonts.mjs";

for (const width of [320, 360, 390, 1280])
  test(`@견적좁은폭 ${width}: 재료 견적 가로 넘침 0, 카드는 화면 안, 첫 로드 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, "/market/quote");
    await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
    const outside = await page.evaluate(() =>
      [...document.querySelectorAll("main section")]
        .map((el) => Math.round(el.getBoundingClientRect().right))
        .filter((right) => right > document.documentElement.clientWidth),
    );
    expect(outside, "화면 밖으로 나간 카드의 오른쪽 끝").toEqual([]);
    await expectNoHorizontalOverflow(page);
    // The price basis control has measured (fonts ready) by now.
    await page.evaluate(() => document.fonts.ready);
    await page.waitForTimeout(600);
    const loaded = await shiftsSince(page);
    expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);
  });

// PM 총괄 11-19: CI once saw the 2nd card's title move 1px up at 152ms @320 (before waking); no font, cut,
// stylesheet or scrollbar reproduced it here. The boxes above it now sit on whole pixels (line heights in px), so
// a sub-pixel change above cannot round it a whole pixel. Checked with the site font served and blocked (the
// matched fallback draws): no first-load shift, the title's top is a whole pixel, and wide screens keep their
// heading lines (only the 18px phone heading is pinned).
test.describe("재료 견적 첫 로드: 글꼴을 받든 막든", () => {
  test.use({ allowConsoleErrors: true });
  for (const width of [320, 360, 1280])
    for (const blocked of [false, true])
      test(`@견적좁은폭 ${width} 글꼴 ${blocked ? "막음" : "받음"}: 첫 로드 흔들림 0, 둘째 카드 제목은 정수 위치 @regression`, async ({ page }) => {
        const errors = [];
        page.on("console", (message) => {
          if (message.type() !== "error") return;
          const source = message.location().url ?? "";
          if (/\.woff2(\?|$)/.test(source) && message.text().includes("net::ERR_FAILED")) return;
          // The shared fixture's own allowances, the same rule (blocked third-party requests, local socket exhaustion, /api/ 4xx).
          if (fixtureIgnoresConsole(message)) return;
          errors.push(message.text());
        });
        page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
        if (blocked) await page.route(/\.woff2(\?|$)/, (route) => route.abort());
        await page.setViewportSize({ width, height: 800 });
        await watchShifts(page);
        await gotoReady(page, "/market/quote");
        await expect(page.getByRole("tablist", { name: "카테고리" })).toBeVisible();
        await page.waitForTimeout(600);
        expect(await drawnFace(page), blocked ? "맞춘 대체 글꼴로 그림" : "사이트 글꼴로 그림").toBe(blocked ? "matched" : "site");
        const loaded = await shiftsSince(page);
        expect(loaded.all, `첫 로드 흔들림 (${loaded.moved})`).toBe(0);
        const top = await page.evaluate(
          () => document.querySelectorAll("main [class*='workspace'] > section")[1]?.querySelector("h2")?.getBoundingClientRect().top ?? null,
        );
        expect(top, "둘째 카드 제목을 찾지 못함").not.toBeNull();
        expect(Math.abs(top - Math.round(top)), `둘째 카드 제목 위치 ${top}px가 정수가 아님`).toBeLessThan(0.01);
        // Wide screens keep their heading lines (20px heading: 1.3 = 26px, 1.1 = 22px; PM-프론트 #1776 P2): only
        // the 18px phone heading is pinned (24 / 20px).
        const lines = await page.evaluate(() => ({
          h1: getComputedStyle(document.querySelector("main h1")).lineHeight,
          h2: getComputedStyle(document.querySelector("main [class*='workspace'] > section h2")).lineHeight,
        }));
        expect(lines, "제목 줄 높이").toEqual(width > 700 ? { h1: "26px", h2: "22px" } : { h1: "24px", h2: "20px" });
        expect(errors, "웹 글꼴 막음 외의 콘솔 오류가 없어야 한다").toEqual([]);
      });
});
