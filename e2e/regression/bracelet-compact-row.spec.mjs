// 사용자 11-01: 전투 탭 팔찌는 한 줄로 — 왼쪽에 아이콘·이름·티어, 가운데 효과 줄 두 칸(줄마다 값은 줄 끝),
// 오른쪽 칸에 팔찌 효율. 좁은 화면은 위에 아이템·효율, 아래에 효과 줄 한 칸. 문장 효과는 두 칸을 다 쓴다.
// 목 '상세' 팔찌: 특화 +111 · 중 치명타 피해 +2.5% · 하 두 줄 효과(공격력·무기 공격력).
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 390, 1280])
  test(`${width}: 팔찌 한 줄 — 아이템 · 효과 줄(값은 줄 끝) · 효율 칸 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const term = page.getByRole("button", { name: /^팔찌 효율/ });
    await expect(term).toBeVisible();
    const row = term.locator("xpath=ancestor::p[1]/..");
    await expect(row.locator("strong").first()).toHaveText("팔찌");
    await expect(row).toContainText("T4");
    const shape = await row.evaluate((el) => {
      const box = (node) => node.getBoundingClientRect();
      const lines = [...el.querySelectorAll("ul > li")];
      const cell = el.querySelector(":scope > p");
      const value = (li) => [...li.children].at(-1);
      const two = lines.slice(0, 2).map(box);
      return {
        count: lines.length,
        // The first two lines side by side (wide) or one under the other (narrow).
        sideBySide: Math.abs(two[0].top - two[1].top) < 2 && two[1].left > two[0].right,
        // Each split line ends with its value, flush with the line's right edge.
        valuesAtEnd: lines.slice(0, 2).every((li) => value(li).textContent.startsWith("+") && Math.abs(box(value(li)).right - box(li).right) <= 1),
        // The two-line effect stays whole, across the list's full width.
        wideLine: Math.abs(box(lines[2]).width - box(el.querySelector("ul")).width) <= 1,
        cellRight: box(cell).left >= box(el.querySelector("ul")).right - 1,
        cellTop: box(cell).bottom <= box(el.querySelector("ul")).top + 1,
      };
    });
    const wide = width >= 1280;
    expect(shape).toEqual({
      count: 3,
      sideBySide: wide,
      valuesAtEnd: true,
      wideLine: true,
      // Wide: the cell is right of the lines; narrow: above them, beside the item.
      cellRight: wide,
      cellTop: !wide,
    });
    await page.waitForTimeout(600);
    const { all, moved } = await shiftsSince(page);
    expect(all, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
