// 회귀(v0.3.2 사용자 결정): 재료 구매 견적의 분류 목록에서 매물이 없는 공식 분류 두 개(장비 상자 10100,
// 보석 상자 220000)만 빠지고, 아바타 등 나머지는 그대로다. 공유 주소로 빠진 분류가 오면 기본 분류(재료)로
// 열리고 주소도 그 분류가 된다. 목록이 도착할 때 흔들림 0.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** The real options answer with the official box categories and 아바타 added around it. */
async function withBoxes(page) {
  await page.route("**/api/markets/options**", async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const list = body.envelope.data.categories;
    body.envelope.data.categories = [
      { code: 10100, codeName: "장비 상자", subs: [] },
      { code: 20000, codeName: "아바타", subs: [{ code: 20005, codeName: "무기" }] },
      ...list,
      { code: 220000, codeName: "보석 상자", subs: [] },
    ];
    return route.fulfill({ response, json: body });
  });
}

for (const width of [1280, 360])
  test(`@견적분류 ${width}: 장비 상자·보석 상자만 빠지고 아바타는 남는다, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) if (!e.hadRecentInput) window.__shifts.push(e.value);
      }).observe({ type: "layout-shift", buffered: true });
    });
    await withBoxes(page);
    await gotoReady(page, "/market/quote");
    const tabs = page.getByRole("tablist", { name: "카테고리" });
    await expect(tabs.getByRole("tab", { name: "아바타" })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "재료" })).toBeVisible();
    await expect(tabs.getByRole("tab", { name: "장비 상자" })).toHaveCount(0);
    await expect(tabs.getByRole("tab", { name: "보석 상자" })).toHaveCount(0);
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => window.__shifts.reduce((a, v) => a + v, 0)), "분류 목록 도착 흔들림").toBe(0);
  });

test("@견적분류 공유 주소로 빠진 분류가 오면 기본 분류로 열리고 주소도 그 분류 @regression", async ({ page }) => {
  await withBoxes(page);
  await gotoReady(page, "/market/quote?category=10100");
  await expect(page.getByRole("tab", { name: "재료", selected: true })).toBeVisible();
  await expect(page).toHaveURL(/[?&]category=50000(&|$)/);
});
