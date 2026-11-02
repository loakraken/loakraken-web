// 회귀(#1248 리뷰 후속): 좁은 화면에서 가로로 넘치는 탭 줄(캐릭터 탭, 시세 묶음 탭)은 끝이 흐려진다. 키보드로
// 탭에 닿으면 브라우저는 줄 끝까지만 굴려, 고른 탭이 흐린 띠 안에 놓였다. 이제 탭이 흐린 띠 밖까지 굴러온다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

/**
 * Focuses each link of a scrolling tab row in turn; returns the ones that sit inside the row's faded ends.
 * The row is the element (the given one or inside it) that scrolls sideways and holds the links.
 */
const focusInFade = (root, fade) =>
  root.evaluate(async (start, size) => {
    const el = [start, ...start.querySelectorAll("*")].find(
      (n) => /auto|scroll/.test(getComputedStyle(n).overflowX) && n.querySelector("a"),
    );
    if (!el) return ["가로로 굴러가는 줄 없음"];
    // A row that fits has no fade to clear.
    if (el.scrollWidth <= el.clientWidth) return [];
    const bad = [];
    for (const link of el.querySelectorAll("a")) {
      link.focus();
      await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      const r = link.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const inner = { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
      // At either scrolled end there is no fade on that side.
      const atStart = el.scrollLeft <= 1;
      const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
      if ((!atStart && r.left < inner.left + size - 1) || (!atEnd && r.right > inner.right - size + 1))
        bad.push(link.textContent.trim());
    }
    return bad;
  }, fade);

for (const width of [320, 390])
  test(`${width}: 키보드로 닿은 탭은 줄 끝 흐린 띠 밖 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoReady(page, characterPath("상세"));
    // The character row's fade is 40px whose outer half is clear: a focused tab clears that clear half at least.
    expect(await focusInFade(page.getByRole("navigation", { name: "캐릭터 정보 탭" }), 20)).toEqual([]);

    await gotoReady(page, "/market");
    // The hub row fades 64px on phones; a focused tab clears half of it.
    expect(await focusInFade(page.getByRole("navigation", { name: "시세 화면" }), 32)).toEqual([]);
  });
