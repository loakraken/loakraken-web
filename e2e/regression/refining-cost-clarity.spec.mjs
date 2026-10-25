// 회귀(#1116·#1117·#1118): 재련 기대 비용.
// - 카드 앞 1·2·3 번호가 없다(재료 구매 견적도 같다).
// - '필요 재료' 표는 가격 기준 탭을 바꿔도 열 폭·표 크기가 그대로이고, 칸 안에서 숫자가 넘치지 않는다.
// - 구매 골드·소모 가치는 한 줄 정의로 구분되고, 긴 설명은 '자세히' 안에 있다.
import { test, expect, expectNoHorizontalOverflow, gotoReady } from "../support/fixtures.mjs";

const startPlan = async (page) => {
  await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+20" }).click();
  await expect(page.getByRole("region", { name: "예상 소모" }).getByText(/총 \d+단계/)).toBeVisible();
};

for (const path of ["/tools/refining", "/tools/material-quote"])
  test(`${path}: 카드 앞 단계 번호가 없다 @regression`, async ({ page }) => {
    await gotoReady(page, path);
    const cards = page.locator("main section[aria-labelledby]");
    await expect(cards.first()).toBeVisible();
    await expect(cards.locator("p").filter({ hasText: /^\s*[1-9]\s*$/ })).toHaveCount(0);
  });

// Each basis answers prices of a different size, so a table that sizes to its
// content would move when the tab changes (the mock alone answers one price).
const FACTOR = { CURRENT_MIN_PRICE: 1, RECENT_PRICE: 1000, YDAY_AVG_PRICE: 0.01 };

for (const width of [701, 840, 1280])
  test(`재련 ${width}: 가격 기준을 바꿔도 필요 재료 표가 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route("**/api/markets/material-prices", async (route) => {
      const factor = FACTOR[route.request().postDataJSON().priceBasis] ?? 1;
      const response = await route.fetch();
      const json = await response.json();
      for (const item of json.data.items) {
        if (item.unitPriceGold != null) item.unitPriceGold *= factor;
        if (item.bundlePrice != null) item.bundlePrice = Math.round(item.bundlePrice * factor * 100) / 100;
      }
      await route.fulfill({ response, json });
    });
    await gotoReady(page, "/tools/refining");
    await startPlan(page);
    const table = page.locator("table[data-wide]");
    await table.scrollIntoViewIfNeeded();
    // 구매 골드 of the first priced material (th is child 1, so td 6).
    const firstGold = table.locator("tbody td:nth-child(6)").filter({ hasText: /\d/ }).first();
    await expect(firstGold).toBeVisible();
    const measure = () =>
      table.evaluate((el) => ({
        table: [Math.round(el.getBoundingClientRect().width), Math.round(el.getBoundingClientRect().height)],
        columns: [...el.querySelectorAll("thead th")].map((th) => {
          const r = th.getBoundingClientRect();
          return [Math.round(r.x), Math.round(r.width)];
        }),
        spills: [...el.querySelectorAll("th, td")].filter((c) => c.scrollWidth > c.clientWidth + 1).map((c) => c.textContent.trim().slice(0, 20)),
      }));
    const bases = page.getByRole("radiogroup", { name: "재료 가격 기준" });
    const first = await measure();
    expect(first.spills, "칸 넘침(현재 최저가)").toEqual([]);
    for (const label of ["최근 거래가", "전일 평균가", "현재 최저가"]) {
      const before = await firstGold.textContent();
      await bases.getByRole("radio", { name: label }).click();
      await expect(firstGold).not.toHaveText(before);
      await expect(page.locator("[aria-busy]").filter({ has: table })).toHaveCount(0);
      const now = await measure();
      expect(now.spills, `칸 넘침(${label})`).toEqual([]);
      expect(now.columns, `열 위치·폭(${label})`).toEqual(first.columns);
      expect(now.table, `표 크기(${label})`).toEqual(first.table);
    }
  });

for (const width of [320, 1280])
  test(`재련 ${width}: 구매 골드·소모 가치 한 줄 정의와 '자세히' @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/tools/refining");
    await startPlan(page);
    const definitions = page.locator("dl").filter({ has: page.locator("dt", { hasText: "구매 골드" }) });
    await expect(definitions.locator("dt")).toHaveText(["구매 골드", "소모 가치"]);
    await expect(definitions.locator("dd").first()).toContainText("부족한 재료");
    await expect(definitions.locator("dd").last()).toContainText("보유와 상관없이");
    const more = page.locator("details").filter({ has: page.locator("summary", { hasText: /^자세히$/ }) });
    await expect(more.getByText(/올림하기 전 기대 소모량/)).toBeHidden();
    await more.locator("summary").click();
    await expect(more.getByText(/올림하기 전 기대 소모량/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
