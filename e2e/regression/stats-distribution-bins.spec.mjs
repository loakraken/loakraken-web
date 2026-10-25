// Stats gap A5: item level comes in steps of 5 levels, and a wide 전투력
// sample joins into a round width so a phone shows at most about 40 bars.
// The mock's 카제로스 sample spreads 전투력 over 1,200 ~ 10,700 in 100s.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { watchShifts, shiftsSince } from "../support/shifts.mjs";

const panel = (page) => page.getByRole("tabpanel", { name: "분포" });

for (const width of [360, 390]) {
  test(`통계 분포: 넓은 표본도 막대 40개 이하, 둥근 구간 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await watchShifts(page);
    await gotoReady(page, "/stats?tab=distribution&server=카제로스");
    const bars = panel(page).getByRole("list", { name: "전투력 구간별 인원" }).getByRole("listitem");
    await expect(bars.first()).toBeVisible();
    const count = await bars.count();
    expect(count).toBeGreaterThan(20);
    expect(count).toBeLessThanOrEqual(40);
    // Joined into 250s: every bar starts on a round number.
    const ranges = await bars.evaluateAll((items) => items.map((li) => li.getAttribute("title") ?? ""));
    for (const range of ranges) {
      const [from, to] = range.split(" · ")[0].split(" ~ ").map((s) => Number(s.replaceAll(",", "")));
      expect(to - from, range).toBe(250);
      expect(from % 250, range).toBe(0);
    }
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await page.waitForTimeout(800);
    const shifts = await shiftsSince(page);
    expect(shifts.all, shifts.moved).toBe(0);
  });
}

test("통계 분포: 아이템 레벨은 5레벨 구간 @regression", async ({ page }) => {
  await gotoReady(page, "/stats?tab=distribution&metric=ITEM_LEVEL&view=table");
  const table = panel(page).getByRole("table", { name: "아이템 레벨 구간별 인원" });
  await expect(table.getByRole("rowheader", { name: "1,710 ~ 1,715", exact: true })).toBeVisible();
});
