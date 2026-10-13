// 회귀(API 목록 #8·#9): 보석 시세 — 겁화·작열 × 10~1레벨 표, 칸을 누르면 싼 매물 10개(쪽 이동),
// 아직 못 읽은 칸은 '집계 중'. 매물이 와도 화면이 흔들리지 않는다(A7). 메뉴에서 들어올 수 있다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

for (const width of [1280, 360]) {
  test(`@보석 ${width} 보석 시세 표와 매물 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__shifts.push({ v: entry.value, input: entry.hadRecentInput });
      }).observe({ type: "layout-shift", buffered: true });
    });
    await gotoReady(page, "/market/gems");
    const board = page.getByRole("table", { name: "보석 시세" });
    await expect(board.getByRole("columnheader")).toHaveText(["레벨", "겁화의 보석", "작열의 보석"]);
    await expect(board.getByRole("rowheader")).toHaveText(["10레벨", "9레벨", "8레벨", "7레벨", "6레벨", "5레벨", "4레벨", "3레벨", "2레벨", "1레벨"]);
    await expect(board.getByRole("button", { name: /매물 보기$/ })).toHaveCount(19);
    await expect(board.getByText("집계 중")).toHaveCount(1);

    await board.getByRole("button", { name: "10레벨 겁화의 보석 매물 보기" }).click();
    await expect(page).toHaveURL(/kind=%EA%B2%81%ED%99%94&level=10/);
    const listings = page.getByRole("table", { name: "보석 매물" });
    await expect(listings.locator("tbody tr")).toHaveCount(10);
    await expect(page.getByRole("heading", { name: /10레벨 겁화의 보석 매물 · 14개 중 싼 순/ })).toBeVisible();
    await page.getByRole("navigation", { name: "매물 쪽 이동" }).getByRole("button", { name: "2" }).click();
    await expect(listings.locator("tbody tr")).toHaveCount(4);

    await page.waitForTimeout(500);
    const quiet = await page.evaluate(() => window.__shifts.filter((e) => !e.input).reduce((a, e) => a + e.v, 0));
    expect(quiet, "첫 로드·매물 도착 뒤 layout-shift").toBe(0);
  });
}

test("보석 시세: 공유 주소로 바로 매물 @regression", async ({ page }) => {
  await gotoReady(page, "/market/gems?kind=%EC%9E%91%EC%97%B4&level=3");
  await expect(page.getByRole("heading", { name: /3레벨 작열의 보석 매물/ })).toBeVisible();
  await expect(page.getByRole("table", { name: "보석 매물" }).locator("tbody tr")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "3레벨 작열의 보석 매물 보기" })).toHaveAttribute("aria-pressed", "true");
});
