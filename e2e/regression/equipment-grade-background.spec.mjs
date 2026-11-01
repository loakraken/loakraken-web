// 회귀(사용자 11-02): 장비 탭의 아이템 그림 뒤 배경은 공식 전투정보실과 같은 등급 배경(등급별 135도 그러데이션)이라
// 등급이 한눈에 구분된다. 장비 탭만 바뀌고(다른 탭의 그림은 그대로), 밝게·어둡게 같은 색, 흔들림 0.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

// The official stylesheet's colours by grade, as the browser reports them.
const OFFICIAL = {
  normal: ["rgb(35, 35, 35)", "rgb(87, 87, 87)"],
  uncommon: ["rgb(24, 34, 11)", "rgb(48, 73, 17)"],
  rare: ["rgb(17, 31, 44)", "rgb(17, 61, 93)"],
  epic: ["rgb(38, 19, 49)", "rgb(72, 13, 93)"],
  legendary: ["rgb(54, 32, 3)", "rgb(158, 95, 4)"],
  relic: ["rgb(52, 26, 9)", "rgb(162, 64, 6)"],
  ancient: ["rgb(61, 51, 37)", "rgb(220, 201, 153)"],
  esther: ["rgb(12, 46, 44)", "rgb(47, 171, 168)"],
};

for (const scheme of ["light", "dark"])
  test(`${scheme}: 장비 탭 그림 뒤는 공식 등급 배경, 다른 탭은 그대로 @regression`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await watchShifts(page);
    await gotoReady(page, characterPath("전투력계산"));
    const panel = page.getByRole("region", { name: "장비", exact: true });
    const icons = panel.locator('[data-tone="official"]');
    await expect(icons.first()).toBeVisible();
    const seen = await icons.evaluateAll((els) =>
      els.map((el) => ({ grade: el.getAttribute("data-grade"), image: getComputedStyle(el).backgroundImage })),
    );
    const graded = seen.filter((icon) => icon.grade in OFFICIAL);
    expect(graded.length, JSON.stringify(seen)).toBeGreaterThan(2);
    for (const icon of graded) {
      expect(icon.image, icon.grade).toContain("linear-gradient(135deg");
      for (const colour of OFFICIAL[icon.grade]) expect(icon.image, icon.grade).toContain(colour);
    }
    // Every graded item on the equipment tab takes it (armour, accessories, stone, orb, bracelet).
    // (Item icon tiles only: they carry --icon-size; effect lines have their own data-grade.)
    expect(
      await panel.locator('[style*="--icon-size"][data-grade]:not([data-grade="unknown"]):not([data-tone="official"])').count(),
    ).toBe(0);
    // Other tabs keep their own tiles.
    expect(await page.locator('[data-tone="official"]').count()).toBe(await icons.count());
    await page.waitForTimeout(500);
    const { all, moved } = await shiftsSince(page);
    expect(all, `흔들림 (${moved})`).toBe(0);
  });
