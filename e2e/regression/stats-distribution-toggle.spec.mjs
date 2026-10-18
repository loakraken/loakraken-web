// #957 (A7): on the distribution tab, switching graph <-> table moved the axis
// line and the note under it (1280 0.0321, 360 0.2054 per press): the two views
// differ in height and the same nodes slid to their new place. They are drawn
// anew per view now, so a press moves nothing, both ways, every width.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@A7 ${width} 통계 분포: 그래프·표 전환에 흔들림 0(누른 직후 포함) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/stats?tab=distribution");
    const panel = page.getByRole("tabpanel", { name: "분포" });
    await expect(panel.getByRole("list", { name: /구간별 인원/ })).toBeVisible();
    await expect(panel.getByRole("region", { name: "집계 기준 안내" })).toBeVisible();
    await page.waitForTimeout(800);
    for (const [press, shows] of [
      ["표로 보기", () => panel.getByRole("table", { name: /구간별 인원/ })],
      ["그래프로 보기", () => panel.getByRole("list", { name: /구간별 인원/ })],
    ]) {
      const moved = await shiftsDuring(page, () => panel.getByRole("button", { name: press }).click(), 800);
      await expect(shows()).toBeVisible();
      expect(moved.all, `${press} 흔들림 (${moved.moved})`).toBe(0);
    }
  });
