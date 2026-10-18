// 회귀(사용자 제보 v0.3.2): 휴대폰에서 캐릭터 화면만 로고가 아이콘뿐이었다(다른 화면은 아이콘 +
// 'LOAKraken'). 모든 화면·너비에서 아이콘과 이름이 함께 보이고, 헤더 높이가 같고, 가로로 넘치지 않는다.
// 캐릭터 화면도 공용 검색 버튼이 있다(헤더 안 검색칸은 900px 이하에서 숨김).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

const PAGES = [
  ["홈", "/"],
  ["캐릭터", characterPath("상세")],
  ["시세", "/market"],
  ["통계", "/stats"],
];

for (const width of [360, 390, 1280])
  test(`@로고 ${width}: 모든 화면에서 아이콘 + LOAKraken, 헤더 높이 같음, 가로 넘침 없음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const heights = [];
    for (const [name, path] of PAGES) {
      await gotoReady(page, path);
      const header = page.locator("header").first();
      const brand = header.getByRole("link", { name: /LOAKraken/ }).first();
      await expect(brand.getByText("LOAKraken", { exact: true }), `${name}: 로고 이름`).toBeVisible();
      const cut = await brand.getByText("LOAKraken", { exact: true }).evaluate((el) => el.scrollWidth > el.clientWidth + 1);
      expect(cut, `${name}: 로고 이름 잘림`).toBe(false);
      // The shared search button (the character page at 1280 also has its own search field's button).
      await expect(header.locator("[data-slot=command-search-trigger]"), `${name}: 공용 검색 버튼`).toBeVisible();
      const overflow = await page.evaluate(() => {
        const head = document.querySelector("header");
        return {
          page: document.documentElement.scrollWidth - window.innerWidth,
          header: head ? head.scrollWidth - head.clientWidth : 0,
          outside: head
            ? [...head.querySelectorAll("*")]
                .filter((el) => el.getClientRects().length && el.getBoundingClientRect().right > window.innerWidth + 0.5)
                .map((el) => el.className || el.tagName)
                .slice(0, 3)
            : [],
        };
      });
      expect(overflow, `${name}: 가로 넘침`).toEqual({ page: 0, header: 0, outside: [] });
      heights.push([name, Math.round((await header.boundingBox()).height)]);
    }
    test.info().annotations.push({ type: "헤더 높이", description: JSON.stringify(heights) });
    expect(new Set(heights.map(([, h]) => h)).size, `헤더 높이 ${JSON.stringify(heights)}`).toBe(1);
  });
