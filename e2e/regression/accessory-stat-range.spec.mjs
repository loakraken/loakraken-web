// 기능(흡수 웨이브 1 #6): 캐릭터 장비의 목걸이·귀걸이·반지마다 기본 효과 힘·민첩·지능이 그 부위·연마 단계 범위(공식
// 아이템 사전)의 몇 %인지 '범위 31.02%'로 보이고, 툴팁의 기본 효과에 값과 범위가 함께 나온다. 범위 밖 값(백엔드가 %를
// 비움)이나 정보가 없는 장신구에는 아무것도 없다. 휴대폰에서도 잘리지 않고 옆으로 넘치지 않는다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [1280, 360])
  test(`@A37 ${width} 장신구 기본 효과 범위 %: 배지와 툴팁, 범위 밖은 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, characterPath("상세"));
    // Only the equipment panel's accessory rows carry the badge.
    const badges = page.locator("[data-stat-range]");
    // The first two accessories in range (31.02%, 94.05%); the third is past its range (no %), the rest have no stats.
    await expect(badges).toHaveText(["범위 31.02%", "범위 94.05%"]);
    await expect(badges.first()).toHaveAccessibleName("힘·민첩·지능 16,009 (범위 15,178 ~ 17,857, 31.02%)");
    for (const badge of await badges.all()) {
      const room = await badge.evaluate((el) => ({ shown: el.clientWidth, needed: el.scrollWidth }));
      expect(room.needed, "배지 글자가 잘리지 않음").toBeLessThanOrEqual(room.shown);
    }
    // The tooltip's 기본 효과: the value and the range under the official lines.
    const row = page.locator("li", { has: badges.first() }).last();
    await row.locator("[data-slot=item-tooltip-trigger]").click();
    const card = page.getByRole("dialog");
    await expect(card).toContainText("민첩 +16009");
    await expect(card).toContainText("힘·민첩·지능 16,009 (범위 15,178 ~ 17,857, 31.02%)");
    await page.keyboard.press("Escape");
    await expectNoHorizontalOverflow(page);
  });
