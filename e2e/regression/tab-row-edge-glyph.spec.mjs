// 회귀(마케팅 11-01): 휴대폰 캐릭터 탭 줄 끝에서 잘린 탭의 첫 획('아크 패시브'의 '아', 끝에서 9px)이 끝 흐림
// (12% = 22px) 안에서 40% 남짓 진하게 남아 '더보기' 앞의 '0'처럼 보였다(390, 처음 연 상태). 탭 줄 끝 흐림은
// 40px로 두고 바깥 절반은 완전히 투명하게 해, 가장자리 20px 안의 획은 보이지 않는다. 끝까지 밀면 흐림(과 투명
// 띠)은 0이라 마지막 탭은 다 보인다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("390: 탭 줄 끝 흐림은 40px, 바깥 절반은 투명, 끝까지 밀면 0 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReady(page, characterPath("상세"));
  const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  // As first opened (not scrolled): the end fade is the full 40px, and the mask
  // has its clear band (two transparent stops at each end).
  const mask = await nav.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      scrolled: el.scrollLeft,
      cut: el.scrollWidth > el.clientWidth,
      fade: parseFloat(style.getPropertyValue("--scroll-fade-e")) || 0,
      clearStops: (style.maskImage || style.webkitMaskImage).split("rgba(0, 0, 0, 0)").length - 1,
    };
  });
  expect(mask).toEqual({ scrolled: 0, cut: true, fade: 40, clearStops: 4 });
  // Scrolled to the end, the last tab shows whole (no fade, no clear band there).
  await nav.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  await expect.poll(() => nav.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--scroll-fade-e")) || 0)).toBe(0);
});
