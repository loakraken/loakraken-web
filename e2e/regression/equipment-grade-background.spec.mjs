// 회귀(사용자 11-02 "모든장비들"): 등급이 있는 아이템 그림 뒤는 어느 화면이든 공식 전투정보실과 같은 등급 배경
// (등급별 135도 그러데이션). 장비·특수 장비·아바타·거래소 줄 모두, 밝게·어둡게 같은 색. 등급 없는 칸(스킬·
// 트라이포드·수집품)은 테마 자리 표시 그대로. 툴팁 카드의 그림 칸도 같은 색. 흔들림 0.
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

/** Every item icon tile on the page (GameIcon: an aria-hidden span carrying --icon-size). */
const tiles = (page) =>
  page.locator('span[aria-hidden="true"][data-grade][style*="--icon-size"]').evaluateAll((els) =>
    els.map((el) => ({ grade: el.getAttribute("data-grade"), image: getComputedStyle(el).backgroundImage })),
  );

const SCREENS = [
  ["장비(전투 탭)", characterPath("전투력계산")],
  ["특수 장비(내실 탭)", characterPath("전투력계산", "collectibles")],
  ["아바타 탭", characterPath("상세", "avatars")],
  ["거래소 시세", "/market"],
];

for (const scheme of ["light", "dark"])
  test(`${scheme}: 등급 있는 아이템 그림은 어느 화면이든 공식 등급 배경 @regression`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await watchShifts(page);
    for (const [name, path] of SCREENS) {
      await gotoReady(page, path);
      await expect(page.locator('span[data-grade][style*="--icon-size"]').first()).toBeAttached();
      const seen = await tiles(page);
      const graded = seen.filter((tile) => tile.grade in OFFICIAL);
      expect(graded.length, `${name}: ${JSON.stringify(seen.slice(0, 5))}`).toBeGreaterThan(0);
      for (const tile of graded) {
        expect(tile.image, `${name} ${tile.grade}`).toContain("linear-gradient(135deg");
        for (const colour of OFFICIAL[tile.grade]) expect(tile.image, `${name} ${tile.grade}`).toContain(colour);
      }
      // Tiles without a grade keep the theme placeholder (not a grade colour).
      for (const tile of seen.filter((t) => t.grade === "unknown"))
        expect(tile.image, `${name} 등급 없음`).toContain("linear-gradient(145deg");
    }
    await page.waitForTimeout(400);
    const { all, moved } = await shiftsSince(page);
    expect(all, `흔들림 (${moved})`).toBe(0);
  });

test("툴팁 카드의 그림 칸도 같은 공식 등급 색 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("전투력계산"));
  const panel = page.getByRole("region", { name: "장비", exact: true });
  const row = panel.getByRole("listitem").filter({ has: page.locator("strong", { hasText: /^목걸이/ }) }).first();
  await row.getByRole("button").first().click();
  const card = page.locator('[data-slot="item-detail"]').first();
  await expect(card).toBeVisible();
  const grade = await card.getAttribute("data-grade");
  const frame = await card.evaluate((el) => {
    const box = [...el.querySelectorAll("div")].find((d) => getComputedStyle(d).backgroundImage.includes("gradient"));
    return box ? getComputedStyle(box).backgroundImage : "";
  });
  for (const colour of OFFICIAL[grade]) expect(frame, grade).toContain(colour);
});
