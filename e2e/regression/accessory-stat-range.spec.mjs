// 기능(흡수 웨이브 1 #6): 캐릭터 장비의 목걸이·귀걸이·반지마다 기본 효과 힘·민첩·지능이 그 부위의 연마 3단계 범위(공식
// 아이템 사전)의 몇 %인지 '범위 31.02%'로 보이고, 툴팁의 기본 효과에 값과 범위가 함께 나온다. 같은 범위로 재므로 100을
// 넘거나(105.34%) 0 아래(−277.24%, 흐린 배지)일 수 있고, 자르지 않고 그대로 보인다. 가장 긴 '범위 −277.24%'도 휴대폰
// 320에서 잘리지 않고, 흔들림 없이 옆으로 넘치지 않는다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

/** The badge's own text (the hidden detail for screen readers is in a child element). */
const shown = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim();

for (const width of [1280, 360, 320])
  test(`@A37 ${width} 장신구 기본 효과 범위 %: 부호 그대로, 툴팁, 잘림·흔들림 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    // Only the equipment panel's accessory rows carry the badge.
    const badges = page.locator("[data-stat-range]");
    await expect(badges).toHaveCount(3);
    expect(await badges.evaluateAll((els) => els.map((el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim()))).toEqual([
      "범위 31.02%",
      "범위 105.34%",
      "범위 −277.24%",
    ]);
    // Below the range: the quieter badge; the others are not.
    await expect(badges.nth(2)).toHaveAttribute("data-below", "true");
    await expect(badges.nth(0)).not.toHaveAttribute("data-below");
    await expect(badges.nth(1)).not.toHaveAttribute("data-below");
    // What the % is measured against, on every badge.
    for (const badge of await badges.all()) await expect(badge).toHaveAttribute("title", "연마 3단계 범위 기준");
    // Screen readers hear the value and the range it is measured against.
    await expect(badges.first()).toHaveText("범위 31.02% · 힘·민첩·지능 16,009 (연마 3단계 범위 15,178 ~ 17,857, 31.02%)");
    expect(await badges.first().evaluate(shown), "보이는 글자").toBe("범위 31.02%");
    for (const badge of await badges.all()) {
      const room = await badge.evaluate((el) => ({ shown: el.clientWidth, needed: el.scrollWidth, text: el.textContent }));
      expect(room.needed, `배지 글자가 잘리지 않음 (${room.text})`).toBeLessThanOrEqual(room.shown);
    }
    // The badges arriving moved nothing (measured before any input).
    const shift = await shiftsSince(page);
    expect(shift.all, `흔들림 (${shift.moved})`).toBe(0);
    // The tooltip's 기본 효과: the value and the 연마 3단계 range under the official lines.
    const row = page.locator("li", { has: badges.first() }).last();
    await row.locator("[data-slot=item-tooltip-trigger]").click();
    const card = page.getByRole("dialog");
    await expect(card).toContainText("민첩 +16009");
    await expect(card).toContainText("힘·민첩·지능 16,009 (연마 3단계 범위 15,178 ~ 17,857, 31.02%)");
    await page.keyboard.press("Escape");
    // The widest the badge can get (a realistic range is about −330 to 100%): the same badge, its number swapped.
    const widest = await badges.nth(2).evaluate((el) => {
      const node = [...el.childNodes].find((n) => n.nodeType === 3 && n.textContent.includes("%"));
      node.textContent = "−999.99%";
      const row = el.closest("li");
      return {
        shown: el.clientWidth,
        needed: el.scrollWidth,
        row: row.scrollWidth <= row.clientWidth,
        page: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      };
    });
    expect(widest.needed, "'범위 −999.99%'도 잘리지 않음").toBeLessThanOrEqual(widest.shown);
    expect(widest.row, "'범위 −999.99%'에도 장신구 줄이 넘치지 않음").toBe(true);
    expect(widest.page, "'범위 −999.99%'에도 옆으로 넘치지 않음").toBe(true);
    await expectNoHorizontalOverflow(page);
  });
