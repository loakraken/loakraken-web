// 추천 순서 total with unknown-cost steps (api #993, PM 총괄 11-19): EFFICIENCY and KRAKEN add the steps
// whose cost is unknown after the priced ones, so totalCost is null; the api sends the known gold
// (knownCostTotal) and the count (unknownCostSteps) beside it. The line reads 'X G + 비용 모름 N단계', each
// such row '비용 모름' with no number; an api before the fields keeps today's '미정(…)'.
// Mock: '스펙순서비용모름' (보석 2단계 260만G + 품질 비용 모름), '…옛' (same, no fields), '…긴' (13 unknown
// steps, a 12억 known total: the widest line at 320).
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const answer = (page) => page.getByRole("region", { name: "추천 순서", exact: true });
const summary = (page) => answer(page).locator("p", { hasText: /^\d+단계를 차례로 올리면/ });
const pathTable = (page) => page.getByRole("table", { name: /^추천 순서, / });
const rows = (page) => pathTable(page).locator("tbody tr:not([data-collapsed])");

for (const width of [320, 1280])
  test.describe(`추천 순서 합계 · 비용 모름 단계 ${width}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
    });

    test("합계는 아는 골드 + 비용 모름 N단계, 그 단계 줄은 숫자 없이 '비용 모름'", async ({ page }) => {
      await page.goto(characterPath("스펙순서비용모름", "specup"));
      await expect(rows(page)).toHaveCount(3);
      await expect(summary(page)).toContainText("합계 260만G + 비용 모름 1단계");
      await expect(summary(page)).not.toContainText("미정");
      // The appended step: its cost cell is the word alone (no gold, no 누적), its per-gold a dash.
      const last = rows(page).nth(2);
      await expect(last).toContainText("품질 90 → 품질 100");
      await expect(last.locator('[data-cell="cost"]')).toHaveText("비용 모름");
      await expect(last.locator('[data-cell="eff"]')).toHaveText("—");
      // The priced steps keep their gold.
      await expect(rows(page).nth(1).locator('[data-cell="cost"]')).toContainText("+200만G");
      await expect(rows(page).nth(1).locator('[data-cell="cost"]')).toContainText("누적 260만G");
      // #993 sends no unpriced list for this order: no '뺀 항목' fold.
      await expect(page.getByText(/시세를 몰라 순서에서 뺀 항목/)).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    });

    test("필드가 없는 응답(#993 전 api)은 지금 문구 그대로: 합계 미정(비용을 모르는 단계가 있어요)", async ({ page }) => {
      await page.goto(characterPath("스펙순서비용모름옛", "specup"));
      await expect(rows(page)).toHaveCount(3);
      await expect(summary(page)).toContainText("합계 미정(비용을 모르는 단계가 있어요)");
      await expect(summary(page)).not.toContainText("+ 비용 모름");
      await expect(rows(page).nth(2).locator('[data-cell="cost"]')).toHaveText("비용 모름");
    });

    test("가장 긴 합계 줄: '+ 비용 모름 N단계'는 한 덩어리로 줄바꿈되고 문단 밖으로 나가지 않음", async ({ page }) => {
      await page.goto(characterPath("스펙순서비용모름긴", "specup"));
      await expect(summary(page)).toContainText("합계 12억 3,456만 7,890G + 비용 모름 13단계");
      const box = await summary(page).evaluate((p) => {
        const piece = [...p.querySelectorAll("span")].find((s) => s.textContent.includes("비용 모름"));
        const lineHeight = parseFloat(getComputedStyle(piece).lineHeight) || 24;
        const rects = [...piece.getClientRects()].filter((r) => r.width > 0);
        const outer = p.getBoundingClientRect();
        return {
          // One line box for the piece (a break inside it gives two rects or a double-height rect).
          lines: rects.length,
          tall: Math.max(...rects.map((r) => r.height)) > lineHeight * 1.5,
          outside: rects.some((r) => r.right > outer.right + 0.5 || r.left < outer.left - 0.5),
        };
      });
      expect(box).toEqual({ lines: 1, tall: false, outside: false });
      await expectNoHorizontalOverflow(page);
    });
  });
