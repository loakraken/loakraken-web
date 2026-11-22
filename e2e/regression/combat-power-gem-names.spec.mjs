// QA v0.3.15 RC P2-1 (PM 총괄 11-22 09:08): on real data the simulator's gem rows all read the gem's name
// ('6레벨 광휘의 보석 (귀속)' eleven times), so eleven level selects shared one accessible name. Each row now says
// which gem it is, and its select's name is the row's visible text + '레벨' (label in name). '상세' has four identical
// 겁화 and seven identical 작열 gems with no skill in the effects, the case where only the slot can tell them apart.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

for (const width of [320, 1280]) {
  test(`${width}: 시뮬레이터 보석 줄 이름과 레벨 선택 이름이 줄마다 다르다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("상세")}`);
    const card = page.locator('section[aria-labelledby="cp-gems"]');
    const rows = card.getByRole("listitem");
    await expect(rows).toHaveCount(11);
    const names = [];
    for (const row of await rows.all()) {
      const name = (await row.locator("span").first().textContent())?.trim() ?? "";
      names.push(name);
      // Label in name, and one select on the page with it.
      await expect(page.getByRole("combobox", { name: `${name} 레벨`, exact: true })).toHaveCount(1);
    }
    expect(new Set(names).size, names.join(" | ")).toBe(11);
  });
}
