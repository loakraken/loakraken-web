// 회귀(사용자 11-02 "모든장비들"): 등급이 있는 아이템 그림 뒤는 어느 화면이든 공식 전투정보실과 같은 등급 배경
// (등급별 135도 그러데이션). 공용 그림 칸(GameIcon)을 쓰는 화면을 모두 잰다: 첫 화면, 캐릭터 탭(전투·스킬·
// 아크 패시브·시뮬레이터·스펙업·내실·아바타), 거래소 시세, 재료 견적. 320·1280, 밝게·어둡게. 등급 없는 칸(스킬·
// 트라이포드·수집품)은 테마 자리 표시 그대로, 칸 크기 그대로, 가로 넘침 없음, 흔들림 0. 툴팁 카드의 그림 칸도 같은 색.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
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
    // Rendered tiles only (a folded section or a layout for the other width draws none).
    els.filter((el) => el.getClientRects().length > 0).map((el) => ({
      grade: el.getAttribute("data-grade"),
      image: getComputedStyle(el).backgroundImage,
      size: [el.offsetWidth, el.offsetHeight],
      wanted: parseFloat(el.style.getPropertyValue("--icon-size")),
    })),
  );

// Every page that draws GameIcon (components that import it, 11-02).
const SCREENS = [
  ["첫 화면", "/"],
  ["캐릭터 전투(장비)", characterPath("전투력계산")],
  ["캐릭터 스킬", characterPath("상세", "skills")],
  ["캐릭터 아크 패시브", characterPath("상세", "arkpassive")],
  ["캐릭터 시뮬레이터", characterPath("상세", "simulator")],
  ["캐릭터 스펙업", characterPath("상세", "specup")],
  ["캐릭터 내실(특수 장비)", characterPath("전투력계산", "collectibles")],
  ["캐릭터 아바타", characterPath("상세", "avatars")],
  ["거래소 시세", "/market"],
  ["재료 견적", "/market/quote"],
];

for (const scheme of ["light", "dark"])
  for (const width of [320, 1280])
    test(`${scheme} ${width}: 공용 그림 칸을 쓰는 모든 화면, 등급 있는 칸은 공식 등급 배경 @regression`, async ({ page }) => {
      test.slow();
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      let graded = 0;
      for (const [name, path] of SCREENS) {
        await gotoReady(page, path);
        await page.waitForTimeout(300);
        const seen = await tiles(page);
        for (const tile of seen) {
          expect(tile.size, `${name} 칸 크기`).toEqual([tile.wanted, tile.wanted]);
          if (tile.grade in OFFICIAL) {
            graded += 1;
            expect(tile.image, `${name} ${tile.grade}`).toContain("linear-gradient(135deg");
            for (const colour of OFFICIAL[tile.grade]) expect(tile.image, `${name} ${tile.grade}`).toContain(colour);
          } else {
            // No grade: the theme placeholder as before (not a grade colour).
            expect(tile.image, `${name} 등급 없음`).toContain("linear-gradient(145deg");
          }
        }
        await expectNoHorizontalOverflow(page);
        const { all, moved } = await shiftsSince(page);
        expect(all, `${name} 흔들림 (${moved})`).toBe(0);
      }
      expect(graded, "등급 있는 칸을 하나 이상 확인").toBeGreaterThan(10);
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
