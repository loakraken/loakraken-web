// 회귀(A7, web #673): 랭킹 표 5종 — 서버 필터를 바꿔 새 행이 와도 열 폭이 다시 잡히지 않는다.
// 누른 직후의 이동(hadRecentInput 포함)까지 0이고, 열 머리 위치가 그대로다.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";

const RANKINGS = [
  ["캐릭터", "/rankings"],
  ["원정대", "/rankings?type=roster"],
  ["수집품", "/rankings?type=collectibles"],
  ["팔찌", "/rankings?type=bracelets"],
  ["길드", "/rankings?type=guilds"],
];

for (const width of [1280, 360]) {
  for (const [name, path] of RANKINGS) {
    test(`@A7 ${width} ${name} 랭킹: 서버를 바꿔도 표가 흔들리지 않는다 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.addInitScript(() => {
        window.__shifts = [];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__shifts.push({ t: entry.startTime, v: entry.value });
        }).observe({ type: "layout-shift", buffered: true });
      });
      await gotoReady(page, path);
      const table = page.getByRole("table").first();
      await expect(table).toBeVisible();
      const heads = () =>
        table.locator("thead th").evaluateAll((cells) => cells.map((cell) => Math.round(cell.getBoundingClientRect().x)));
      const before = await heads();
      const start = await page.evaluate(() => performance.now());
      await chooseOption(page, page.getByRole("combobox", { name: "서버" }), "아만");
      await expect(page).toHaveURL(/server=/);
      await expect(table).not.toHaveAttribute("aria-busy", "true");
      await page.waitForTimeout(800);
      const shifted = await page.evaluate(
        (from) => window.__shifts.filter((entry) => entry.t >= from).reduce((sum, entry) => sum + entry.v, 0),
        start,
      );
      expect(shifted, "서버를 바꾼 뒤 layout-shift(입력 직후 포함)").toBe(0);
      expect(await heads()).toEqual(before);
    });
  }
}
