// 기능(흡수 웨이브 1 #11): 시세에 '아바타'와 '장비 상자' 분류가 더해진다. 티어 없이(생활·요리처럼) 같은 정렬·검색을 쓰고,
// 탭 줄에 두 탭이 다른 탭과 같은 모양으로 놓인다. 눌러 바꿀 때 흔들림 0, 휴대폰에서도 옆으로 넘치지 않는다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 390, 320])
  test(`@A7 ${width} 시세 아바타·장비 상자 분류: 티어 없이 보드, 바꿀 때 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market");
    const tabs = page.getByRole("tablist", { name: "시세 분류" });
    for (const [label, id] of [
      ["아바타", "AVATAR"],
      ["장비 상자", "EQUIPMENT_BOX"],
    ]) {
      const tab = tabs.getByRole("tab", { name: label, exact: true });
      await expect(tab).toBeEnabled();
      await tab.scrollIntoViewIfNeeded();
      const moved = await shiftsDuring(page, () => tab.click());
      await expect(page).toHaveURL(new RegExp(`tab=${id}`));
      await expect(page.getByRole("heading", { level: 2, name: new RegExp(`^${label} 시세`) })).toBeVisible();
      await expect(page.locator("section[aria-labelledby=board-heading] li button").first()).toBeVisible();
      // No tier on these kinds.
      await expect(page.getByRole("group", { name: "티어" })).toHaveCount(0);
      expect(moved.all, `${label} 탭 누를 때 흔들림 (${moved.moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
    }
  });
