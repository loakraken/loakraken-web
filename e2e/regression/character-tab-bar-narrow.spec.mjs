// 회귀(#1324, 풀스택 PM 결정 11-02): 400px 이하 휴대폰에서 캐릭터 탭은 더보기·갱신 아래 한 줄을 다 쓴다. 옆에 두면 320에서
// 탭 줄이 113px밖에 안 돼, 어떤 탭도 양 끝 흐림(40px) 밖에 놓일 수 없었다. 더보기·갱신은 글자 그대로 첫 줄에 있고,
// 탭 바 높이는 고정이라 어느 탭으로 바꿔도 아래가 움직이지 않는다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

/**
 * The tab bar's height; whether the tab row spans the bar (inside its 12px gutters, plus its 8px focus room each
 * side) under the actions; the actions' visible labels, any cut one, and the page's sideways overflow.
 */
const barState = (page) =>
  page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="캐릭터 정보 탭"]');
    const actions = nav.nextElementSibling;
    const tabsTop = Math.min(...[...nav.querySelectorAll("a")].map((a) => a.getBoundingClientRect().top));
    const shown = [...actions.querySelectorAll("button, a")].filter((el) => el.getBoundingClientRect().width > 0);
    const page = document.documentElement.clientWidth;
    return {
      height: nav.closest("[data-sticky-chrome]").offsetHeight,
      fullRow: Math.abs(nav.getBoundingClientRect().width - (page - 24 + 16)) <= 1,
      actionsAbove: actions.getBoundingClientRect().bottom <= tabsTop,
      labelled: shown.filter((el) => el.innerText.trim()).length >= 2,
      cut: shown.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => el.innerText.trim() || el.getAttribute("aria-label")),
      overflow: document.documentElement.scrollWidth - page,
    };
  });
// 92px row + 1px border.
const expected = { height: 93, fullRow: true, actionsAbove: true, labelled: true, cut: [], overflow: 0 };

for (const width of [320, 360, 390])
  test(`${width}: 탭은 더보기·갱신 아래 한 줄을 다 쓰고, 어느 탭에서도 잘림·넘침·흔들림 0 @regression`, async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
    await expect(nav).toHaveAttribute("data-pill", "on");
    expect(await barState(page)).toEqual(expected);

    const names = (await nav.getByRole("link").allInnerTexts()).map((n) => n.replace(/\s+/g, " ").trim());
    for (const name of [...names.slice(1), names[0]]) {
      const moved = await shiftsDuring(page, () => nav.getByRole("link", { name, exact: true }).click(), 1500);
      expect(moved.all, `${name} 탭 전환 흔들림 (${moved.moved})`).toBe(0);
      expect(await barState(page), `${name} 탭`).toEqual(expected);
    }
  });
