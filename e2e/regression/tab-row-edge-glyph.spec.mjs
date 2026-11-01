// 회귀(마케팅 11-01): 휴대폰 캐릭터 탭 줄 끝에서 잘린 탭의 첫 획('아크 패시브'의 '아', 끝에서 9px)이 끝 흐림
// (12% = 22px) 안에서 40% 남짓 진하게 남아 '더보기' 앞의 '0'처럼 보였다(390). 탭 줄 끝 흐림은 40px로 두고 바깥
// 절반은 완전히 투명하게 해, 가장자리 20px 안의 획은 보이지 않는다. 끝까지 밀면 흐림(과 투명 띠)은 0이라 마지막
// 탭은 다 보인다. 운영과 같은 자리(첫 글자가 끝에서 9px)에 잘린 탭을 두고 확인한다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("390: 탭 줄 끝에서 잘린 탭 글자는 투명 띠에 가려진다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await gotoReady(page, characterPath("상세"));
  const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  const mask = await nav.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      fade: parseFloat(style.getPropertyValue("--scroll-fade-e")) || 0,
      // Clear at both ends twice over: the outer half of each fade is transparent.
      clearStops: (style.maskImage || style.webkitMaskImage).split("rgba(0, 0, 0, 0)").length - 1,
    };
  });
  expect(mask).toEqual({ fade: 40, clearStops: 4 });
  // A tab cut where the live page had it: its first glyph 9px from the row's end.
  const alpha = await nav.evaluate((el) => {
    const box = () => el.getBoundingClientRect();
    const glyphOf = (a) => {
      const range = document.createRange();
      range.setStart(a.firstChild, 0);
      range.setEnd(a.firstChild, 1);
      return range.getBoundingClientRect();
    };
    const tab = [...el.querySelectorAll(":scope > a")].find((a) => a.getBoundingClientRect().right > box().right + 0.5);
    el.scrollLeft += glyphOf(tab).left - (box().right - 9);
    const fromEnd = box().right - glyphOf(tab).left;
    const fade = parseFloat(getComputedStyle(el).getPropertyValue("--scroll-fade-e")) || 0;
    // The mask's opacity there: clear in the outer half of the fade, full at its inner edge.
    return fromEnd <= fade / 2 ? 0 : fromEnd >= fade ? 1 : (fromEnd - fade / 2) / (fade / 2);
  });
  expect(alpha, "끝에서 9px인 첫 글자의 불투명도").toBe(0);
  // Scrolled to the end, the last tab shows whole (no fade, no clear band there).
  await nav.evaluate((el) => (el.scrollLeft = el.scrollWidth));
  await expect.poll(() => nav.evaluate((el) => parseFloat(getComputedStyle(el).getPropertyValue("--scroll-fade-e")) || 0)).toBe(0);
});
