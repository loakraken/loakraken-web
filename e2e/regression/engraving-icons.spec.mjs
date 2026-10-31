// 회귀(사용자 10-31, 백엔드 #780): 각인 이름 왼쪽에 각인 아이콘. 이름은 띄어쓰기를 빼고 맞춘다('잔재된 기운' =
// '잔재된기운'). 아이콘이 없는 각인은 빈 자리(회색 상자 없음)이고, 자리는 처음부터 잡혀 있어 이름이 움직이지 않는다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [360, 1280])
  test(`${width}: 각인 아이콘은 이름 왼쪽, 없으면 빈 자리, 이름 줄 맞춤 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const panel = page.getByRole("region", { name: "각인", exact: true });
    const row = (name) => panel.locator("li").filter({ has: page.getByText(name, { exact: true }) }).first();
    // Matched without spaces; a name with no icon keeps an empty slot.
    await expect(row("잔재된 기운").locator("img")).toHaveAttribute("src", /achieve_13\.png$/);
    await expect(row("원한").locator("img")).toHaveCount(1);
    await expect(row("질량 증가").locator("img")).toHaveCount(0);
    // Every name starts at the same x (the icon slot is always there).
    const lefts = await panel.locator("li strong").evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().left)));
    expect(new Set(lefts).size, `이름 시작 위치 ${lefts}`).toBe(1);
    await page.waitForTimeout(600);
    const { quiet, moved } = await shiftsSince(page);
    expect(quiet, `흔들림 (${moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });
