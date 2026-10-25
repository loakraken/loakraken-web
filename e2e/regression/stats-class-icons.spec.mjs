// 회귀(통계 A1): 통계의 직업 줄마다 공식 직업 아이콘(공식 CDN의 SVG, 화면 가까이 올 때만 받음). 아이콘은
// 고정 상자라 줄이 움직이지 않고, 이름 옆이라 화면 낭독에서는 건너뛴다(행 머리 이름 = 직업 이름).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const TABLES = [
  { path: "/stats", table: "직업별 인원과 전투력 분포" },
  { path: "/stats?tab=best", table: "직업별 최고 전투력" },
];

for (const width of [320, 1280])
  for (const { path, table } of TABLES)
    test(`@직업아이콘 ${width} ${table}: 줄마다 공식 아이콘, 이름은 그대로, 흔들림 0 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await watchShifts(page);
      await gotoReady(page, path);
      const rows = page.getByRole("table", { name: table }).getByRole("rowheader");
      await expect(rows.first()).toBeVisible();
      const cells = await rows.evaluateAll((ths) =>
        ths.map((th) => {
          const icon = th.querySelector("img");
          const box = icon?.getBoundingClientRect();
          return {
            name: th.textContent.trim(),
            src: icon?.getAttribute("src") ?? null,
            alt: icon?.getAttribute("alt") ?? null,
            loading: icon?.getAttribute("loading") ?? null,
            size: box ? [Math.round(box.width), Math.round(box.height)] : null,
          };
        }),
      );
      expect(cells.length).toBeGreaterThan(0);
      for (const cell of cells) {
        expect(cell.src, cell.name).toMatch(/^https:\/\/cdn-lostark\.game\.onstove\.com\/2018\/obt\/assets\/images\/common\/class\/[a-z_]+\.svg$/);
        // Decorative (the name is next to it), held at its size before it loads, loaded only near view.
        expect(cell.alt, cell.name).toBe("");
        expect(cell.size, cell.name).toEqual([20, 20]);
        expect(cell.loading, cell.name).toBe("lazy");
      }
      // The icon adds nothing to what a screen reader reads for the row.
      const first = cells[0].name;
      await expect(rows.first()).toHaveAccessibleName(first);
      await page.waitForTimeout(600);
      const { all, moved } = await shiftsSince(page);
      expect(all, `흔들림 (${moved})`).toBe(0);
      await expectNoHorizontalOverflow(page);
    });
