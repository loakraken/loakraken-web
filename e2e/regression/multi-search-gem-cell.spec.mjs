// QA v0.3.1 P1-1 (A37): the gem cell '최고 Lv.9 (1개)' was cut to 'Lv.9 (1'
// at 1280 in the light and dim themes. The longest value is a best mark plus
// 'Lv.9.5 (10개)' (one decimal, 10 of 11 gems); every theme must show it whole.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const GEMS = {
  비교1: { averageLevel: 9.5, count: 10 }, // best, longest text
  비교2: { averageLevel: 9, count: 1 },
  비교3: { averageLevel: 7.3, count: 11 },
};

async function withGems(page) {
  await page.route("**/api/characters?*", async (route) => {
    const name = new URL(route.request().url()).searchParams.get("characterName");
    const response = await route.fetch();
    const body = await response.json();
    if (GEMS[name] && body?.data?.analysis?.gems) Object.assign(body.data.analysis.gems, GEMS[name]);
    await route.fulfill({ response, json: body });
  });
}

const cut = (els) =>
  els.filter((el) => el.scrollWidth > el.clientWidth + 1).map((el) => `${el.textContent.trim()} ${el.clientWidth}<${el.scrollWidth}`);

for (const theme of ["light", "dim", "dark"])
  test(`@A37 멀티서치 보석 칸은 ${theme}에서도 '최고 Lv.9.5 (10개)'를 자르지 않는다 @regression`, async ({ page }) => {
    await page.addInitScript((t) => localStorage.setItem("loakraken-theme", t), theme);
    await withGems(page);
    await gotoReady(page, "/multi-search?names=비교1,비교2,비교3");
    const wide = page.viewportSize().width > 640;
    const view = page.getByRole("region", { name: wide ? "캐릭터 비교 표" : "캐릭터 비교 카드" });
    await expect(view).toContainText("Lv.9.5 (10개)");
    await expect(view).toContainText("Lv.9 (1개)");
    await expect(view).toContainText("Lv.7.3");
    if (wide) {
      // Every value cell, not only gems: a number or label cut by the cell is A37.
      const cells = view.locator("tbody td");
      expect(await cells.evaluateAll(cut)).toEqual([]);
      const best = view.locator("tbody td").filter({ hasText: "Lv.9.5 (10개)" });
      await expect(best).toContainText("최고");
    } else {
      expect(await view.locator('[class*="cardValue"]').evaluateAll(cut)).toEqual([]);
    }
  });
