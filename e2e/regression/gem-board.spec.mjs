// 회귀(API 목록 #8·#9): 보석 시세 — 겁화·작열 × 10~1레벨 표, 칸을 누르면 싼 매물 10개(쪽 이동),
// 아직 못 읽은 칸은 '집계 중'. 매물이 와도 화면이 흔들리지 않는다(A7). 메뉴에서 들어올 수 있다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** Line boxes each element's text takes (1 = no wrap), from its text nodes only. */
const lineCounts = (locator) =>
  locator.evaluateAll((els) =>
    els.map((el) => {
      const tops = new Set();
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        const range = document.createRange();
        range.selectNodeContents(node);
        for (const r of range.getClientRects()) if (r.width > 0) tops.add(Math.round(r.top));
      }
      return tops.size;
    }),
  );

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
    const board = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" });
    await expect(board.getByRole("columnheader")).toHaveText(["레벨", "겁화의 보석", "작열의 보석"]);
    await expect(board.getByRole("rowheader")).toHaveText(["10레벨", "9레벨", "8레벨", "7레벨", "6레벨", "5레벨", "4레벨", "3레벨", "2레벨", "1레벨"]);
    await expect(board.getByRole("button", { name: /매물 보기$/ })).toHaveCount(19);
    await expect(board.getByText("집계 중")).toHaveCount(1);
    // Gold amounts carry the unit as on the exchange board, on one line; counts stay plain.
    const cell = board.getByRole("button", { name: "10레벨 겁화의 보석 매물 보기" });
    await expect(cell.locator("b")).toHaveText(/^[\d,]+G$/);
    await expect(cell.locator("small").last()).toHaveText(/^매물 [\d,]+$/);
    expect(await lineCounts(board.getByRole("button", { name: /매물 보기$/ }).locator("b")), "금액 한 줄").toEqual(Array(19).fill(1));

    // A7: from the first press on, shifts right after an input count too.
    const firstLoad = await page.evaluate(() => window.__shifts.reduce((a, e) => a + e.v, 0));
    expect(firstLoad, "첫 로드 layout-shift").toBe(0);
    await page.evaluate(() => (window.__shifts = []));
    await board.getByRole("button", { name: "10레벨 겁화의 보석 매물 보기" }).click();
    await expect(page).toHaveURL(/kind=%EA%B2%81%ED%99%94&level=10/);
    const listings = page.getByRole("table", { name: "보석 매물" });
    await expect(listings.locator("tbody tr:not([aria-hidden])")).toHaveCount(10);
    await expect(page.getByRole("heading", { name: /10레벨 겁화의 보석 매물 · 14개 중 싼 순/ })).toBeVisible();
    const first = listings.locator("tbody tr:not([aria-hidden])").first().locator("td");
    await expect(first.nth(0)).toHaveText(/^[\d,]+G$/);
    await expect(first.nth(1)).toHaveText(/^([\d,]+G|-)$/);
    await page.getByRole("navigation", { name: "매물 쪽 이동" }).getByRole("button", { name: "2" }).click();
    await expect(listings.locator("tbody tr:not([aria-hidden])")).toHaveCount(4);

    await page.waitForTimeout(500);
    const moved = await page.evaluate(() => window.__shifts.reduce((a, e) => a + e.v, 0));
    expect(moved, "칸 누름·쪽 이동 뒤 layout-shift(입력 직후 포함)").toBe(0);
  });
}

// User report 10-25: while a cell was '집계 중', its moving light ran past the
// table's scroll box now and then, so a scrollbar came and went under the table
// and everything below jumped. Sampled over the light's run, every 50ms.
for (const width of [1280, 1180, 360])
  test(`@보석 ${width} 집계 중 칸이 있어도 표 상자가 옆으로 넘치지 않음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market/gems");
    const board = page.getByRole("table", { name: "4티어 보석 레벨별 즉시 구매 최저가" });
    await expect(board.getByText("집계 중")).toHaveCount(1);
    const sample = () =>
      board.evaluate(async (table) => {
        const box = table.closest('[data-slot="data-table"]');
        let worst = 0;
        for (const end = performance.now() + 3000; performance.now() < end; ) {
          worst = Math.max(worst, box.scrollWidth - box.clientWidth, box.scrollHeight - box.clientHeight);
          await new Promise((ok) => setTimeout(ok, 50));
        }
        return worst;
      });
    expect(await sample(), "집계 중일 때 표 상자 넘침(px)").toBe(0);
    // With the last row's cell picked as well (the reported screen).
    await board.getByRole("button", { name: "1레벨 겁화의 보석 매물 보기" }).click();
    await expect(board.getByRole("button", { name: "1레벨 겁화의 보석 매물 보기" })).toHaveAttribute("aria-pressed", "true");
    expect(await sample(), "칸을 고른 뒤 표 상자 넘침(px)").toBe(0);
  });

test("보석 시세: 공유 주소로 바로 매물 @regression", async ({ page }) => {
  await gotoReady(page, "/market/gems?kind=%EC%9E%91%EC%97%B4&level=3");
  await expect(page.getByRole("heading", { name: /3레벨 작열의 보석 매물/ })).toBeVisible();
  await expect(page.getByRole("table", { name: "보석 매물" }).locator("tbody tr:not([aria-hidden])")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "3레벨 작열의 보석 매물 보기" })).toHaveAttribute("aria-pressed", "true");
});
