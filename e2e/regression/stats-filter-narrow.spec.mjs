// 회귀(사용자 11-08): 통계 조건 막대의 '역할'(전체·딜러·서포터)이 320에서 카드 밖으로 19px 나갔다
// (한글 글꼴이 넓은 환경). 글자를 일부러 넓혀도(자간) 320·360에서 가로 넘침 없이, 모든 칸이 카드 안에 보인다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

// A wider Korean font, the same on every machine: extra letter spacing in the bar.
const WIDE = ".statsBarWide, .statsBarWide * { letter-spacing: 0.12em !important; }";

for (const width of [320, 360])
  for (const wide of [false, true])
    test(`통계 ${width}${wide ? " 넓은 글꼴" : ""}: 역할·기간 칸이 카드 안, 가로 넘침 없음 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await gotoReady(page, "/stats");
      const bar = page.getByRole("form", { name: "통계 조건" });
      await expect(bar).toBeVisible();
      if (wide) {
        await page.addStyleTag({ content: WIDE });
        await bar.evaluate((el) => el.classList.add("statsBarWide"));
      }
      for (const name of ["역할", "기간"]) {
        const group = bar.getByRole("radiogroup", { name });
        await expect(group).toBeVisible();
        const inside = await group.evaluate((el) => {
          const card = el.closest("form").getBoundingClientRect();
          return [...el.querySelectorAll("[data-slot='segmented-item']")].map((item) => {
            const r = item.getBoundingClientRect();
            // The label's own glyphs (not the item's hidden radio input) inside the pill.
            const walker = document.createTreeWalker(item, NodeFilter.SHOW_TEXT);
            const range = document.createRange();
            const glyphs = walker.nextNode();
            range.selectNodeContents(glyphs);
            const text = range.getBoundingClientRect();
            return (
              r.left >= card.left - 0.5 &&
              r.right <= card.right + 0.5 &&
              text.left >= r.left - 0.5 &&
              text.right <= r.right + 0.5
            );
          });
        });
        expect(inside, `${name}: 칸이 카드 안에, 글자 잘림 없이`).toEqual(inside.map(() => true));
      }
      await expectNoHorizontalOverflow(page);
    });
