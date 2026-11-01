// 회귀(사용자 11-02, 아이폰): 휴대폰 머리 줄에서 검색·테마·메뉴 단추가 로고 바로 뒤(가운데)에 붙어 있었다.
// 로고는 왼쪽, 세 단추는 오른쪽 끝에 붙고 사이 간격은 그대로, 누름 영역 44px, 첫 로드 흔들림 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const PAGES = ["/market", "/schedule", characterPath("상세")];

for (const width of [320, 360, 390, 430])
  test(`${width}: 머리 줄의 검색·테마·메뉴는 오른쪽 끝, 로고는 왼쪽 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    for (const path of PAGES) {
      await gotoReady(page, path);
      const header = page.locator("header[data-sticky-chrome]");
      const menu = header.getByRole("button", { name: "메뉴 열기" });
      await expect(menu).toBeVisible();
      const box = await header.evaluate((el) => {
        // The rendered one: the character page's own search box (in the page slot, hidden up to 900px)
        // carries the same "캐릭터 검색" name and comes first in the DOM.
        const r = (sel) => [...el.querySelectorAll(sel)].map((n) => n.getBoundingClientRect()).find((b) => b.width > 0);
        const pad = parseFloat(getComputedStyle(el).paddingRight);
        const brand = el.querySelector('a[aria-label="LOAKraken 홈"]').getBoundingClientRect();
        const search = r('[aria-label="캐릭터 검색"]');
        const theme = r('[aria-label="화면 테마"]');
        const menu = r('[aria-label="메뉴 열기"]');
        return {
          right: Math.round(el.getBoundingClientRect().right - pad - menu.right),
          brandLeft: Math.round(brand.left - el.getBoundingClientRect().left - parseFloat(getComputedStyle(el).paddingLeft)),
          freeAfterBrand: Math.round(search.left - brand.right),
          searchToTheme: Math.round(theme.left - search.right),
          themeToMenu: Math.round(menu.left - theme.right),
        };
      });
      // The menu touches the content's right edge; the logo stays at the left.
      expect(Math.abs(box.right), `${path} 메뉴 오른쪽 ${JSON.stringify(box)}`).toBeLessThanOrEqual(1);
      expect(Math.abs(box.brandLeft), `${path} 로고 왼쪽`).toBeLessThanOrEqual(1);
      // The three stay together (the same small gaps as before), the free space sits after the logo.
      expect(box.searchToTheme, `${path} 검색-테마`).toBeLessThanOrEqual(10);
      expect(box.themeToMenu, `${path} 테마-메뉴`).toBeLessThanOrEqual(10);
      expect(box.freeAfterBrand, `${path} 로고 뒤 빈 곳`).toBeGreaterThanOrEqual(0);
      await expectNoHorizontalOverflow(page);
      // Per page: each load starts its own count.
      await page.waitForTimeout(400);
      const { all, moved } = await shiftsSince(page);
      expect(all, `${path} 흔들림 (${moved})`).toBe(0);
    }
  });
