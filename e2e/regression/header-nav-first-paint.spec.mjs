// 회귀(A7 첫 로드 흔들림, 남은 화면 훑기: 머리글 메뉴): 첫 HTML은 어디서든 끊겨 올 수 있다. 본문 글자가 큰 화면(/about 27px 줄,
// /contact·문서 24px 줄)에서 메뉴 항목이 줄 상자를 가져, 글자가 아직 없는 탭(기준선이 아래 끝)이 그 줄 위에 앉으면 메뉴가
// 44px이었다가 글자가 오면 36px로 줄었다(11-15 훑기, 1280). 메뉴 안을 어디서 잘라도 머리글이 움직이지 않고, 다 그려진 메뉴는
// 어느 화면에서나 36px이다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { cutEverywhere } from "../support/first-paint.mjs";

const NAV = 'nav[aria-label="주요 메뉴"]';

for (const path of ["/about", "/contact", "/privacy", "/"])
  test(`@A7 1280 ${path}: 첫 HTML이 메뉴 안에서 끊겨도 머리글이 움직이지 않는다 @regression`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 1280, height: 900 });
    await gotoReady(page, path);
    await page.evaluate(() => document.fonts.ready);
    const nav = page.locator(NAV);
    await expect(nav.getByRole("link", { name: "소개" })).toBeVisible();
    // The same 36px menu on every page, whatever the page's own body line is.
    expect(Math.round((await nav.boundingBox())?.height ?? 0)).toBe(36);
    const cut = await cutEverywhere(page, `${NAV}|`);
    expect(cut.probed, cut.moved.join(" / ")).toBeGreaterThan(10);
    expect(cut.value, `늦게 온 부분이 민 것:\n${cut.moved.slice(0, 8).join("\n")}`).toBe(0);
  });
