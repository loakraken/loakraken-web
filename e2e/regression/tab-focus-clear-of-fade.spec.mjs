// 회귀(#1248 리뷰 후속, #1324): 좁은 화면에서 가로로 넘치는 탭 줄(캐릭터 탭, 시세 묶음 탭)은 끝이 흐려진다. 키보드로
// 탭에 닿으면 브라우저는 줄 안에 이미 (반쯤이라도) 보이는 탭은 굴리지 않아, 고른 탭이 흐린 띠 안에 놓였다. 이제 탭이
// 흐린 띠 밖까지 굴러온다. 실제 Tab 키로 차례로 닿는다(키보드 초점일 때만 줄이 움직인다). 줄만 굴리고 화면은
// 위아래로 움직이지 않는다(#1331).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

/**
 * Where the focused link rests in the scrolling row under `root` (the given element or one inside it that scrolls
 * sideways and holds the links): whether it lies inside the faded ends, once the row stops moving.
 */
const restInFade = (root, fade) =>
  root.evaluate(async (start, size) => {
    const el = [start, ...start.querySelectorAll("*")].find(
      (n) => /auto|scroll/.test(getComputedStyle(n).overflowX) && n.querySelector("a"),
    );
    if (!el) return { overflows: false, label: "가로로 굴러가는 줄 없음", bad: true };
    const link = document.activeElement;
    if (!el.contains(link)) return { overflows: false, label: `줄 밖 초점: ${link?.textContent?.trim()}`, bad: true };
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    // Until the row stops moving (a smooth scroll would take several frames).
    let last = NaN;
    for (let i = 0; i < 60 && el.scrollLeft !== last; i++) {
      last = el.scrollLeft;
      await frame();
      await frame();
    }
    const label = link.textContent.trim();
    if (el.scrollWidth <= el.clientWidth) return { overflows: false, label, bad: false };
    const r = link.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    const inner = { left: box.left + parseFloat(style.paddingLeft), right: box.right - parseFloat(style.paddingRight) };
    // At either scrolled end there is no fade on that side.
    const atStart = el.scrollLeft <= 1;
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1;
    const bad = (!atStart && r.left < inner.left + size - 1) || (!atEnd && r.right > inner.right - size + 1);
    return { overflows: true, label, bad };
  }, fade);

/**
 * Tabs through the row's links from the first one and names those that come to rest inside its faded ends, and
 * those whose focus moved the page up or down: only the row scrolls, never the page (#1331).
 */
async function focusInFade(page, nav, fade) {
  const links = nav.getByRole("link");
  const count = await links.count();
  // Before the first focus too: the row is on screen, so even that one moves nothing.
  const top = await page.evaluate(() => window.scrollY);
  await links.first().focus();
  let overflows = false;
  const bad = [];
  const pageMoved = [];
  for (let i = 0; i < count; i++) {
    if (i > 0) await page.keyboard.press("Tab");
    const rest = await restInFade(nav, fade);
    overflows ||= rest.overflows;
    if (rest.bad) bad.push(rest.label);
    if ((await page.evaluate(() => window.scrollY)) !== top) pageMoved.push(rest.label);
  }
  return { overflows, bad, pageMoved };
}

for (const width of [320, 360, 390])
  test(`${width}: 키보드로 닿은 탭은 줄 끝 흐린 띠 밖 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoReady(page, characterPath("상세"));
    // The character row's fade is 40px whose outer half is clear: a focused tab clears that clear half at least.
    // It always overflows at these widths (otherwise the check would prove nothing).
    const character = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
    // Awake (the pill is placed, and the row scrolled to the current tab if it had to).
    await expect(character).toHaveAttribute("data-pill", "on");
    // The page can scroll, so "the page did not move" proves something.
    expect(await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight)).toBe(true);
    expect(await focusInFade(page, character, 20)).toEqual({ overflows: true, bad: [], pageMoved: [] });

    await gotoReady(page, "/market");
    // The hub row fades 64px on phones; a focused tab clears half of it. A row that fits has no fade.
    const hub = page.getByRole("navigation", { name: "시세 화면" });
    const { bad, pageMoved } = await focusInFade(page, hub, 32);
    expect({ bad, pageMoved }).toEqual({ bad: [], pageMoved: [] });
  });

test("마우스로 누르는 동안 탭 줄이 움직이지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await gotoReady(page, characterPath("상세"));
  const row = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
  await expect(row).toHaveAttribute("data-pill", "on");
  // The first tab reaching into the row's end fade, which keyboard focus would scroll clear. A press focuses it
  // too, but the row stays still under the pointer until release, or the click lands on another tab (#1077).
  const press = await row.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const tab = [...el.querySelectorAll("a")].find((a) => a.getBoundingClientRect().right > box.right - 40);
    const r = tab.getBoundingClientRect();
    const x = Math.min(r.left + 12, box.right - 4);
    return { label: tab.textContent.trim(), x, y: r.top + r.height / 2, scrollLeft: el.scrollLeft, scrollY: window.scrollY };
  });
  await page.mouse.move(press.x, press.y);
  await page.mouse.down();
  await expect(row.getByRole("link", { name: press.label, exact: true })).toBeFocused();
  // Neither the row nor the page.
  expect(await row.evaluate((el) => ({ scrollLeft: el.scrollLeft, scrollY: window.scrollY }))).toEqual({
    scrollLeft: press.scrollLeft,
    scrollY: press.scrollY,
  });
  await page.mouse.up();
});
