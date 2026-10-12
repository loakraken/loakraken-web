// T4 악세 경매 검색기(/tools/accessory-search, 체크리스트 N13, 백엔드 #431).
// 목 서버: 힘민지 범위 조건이면 1쪽은 일부(complete false, nextPage 4), 매물 중
// 하나는 입찰만, 하나는 거래 불가. 품질 99는 503 MARKET_SEARCH_BUSY(Retry-After 30).
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

test.describe("악세 경매 검색 @smoke", () => {
  test("조건으로 검색하면 즉시 구매가 순 매물과 연마 효과·거래 상태를 보여 준다", async ({ page }) => {
    await gotoReady(page, "/tools/accessory-search");
    await expect(page.getByRole("heading", { level: 1, name: "악세 경매 검색" })).toBeVisible();
    await chooseOption(page, page.getByRole("combobox", { name: "적에게 주는 피해 증가" }), "상 이상");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const results = page.getByRole("region", { name: "매물" });
    const items = results.getByRole("listitem").filter({ hasText: "테스트 장신구" });
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("135만G");
    await expect(items.nth(0)).toContainText("적주피 2.00% 상");
    await expect(items.nth(1)).toContainText("입찰만 가능");
    await expect(items.nth(2)).toContainText("거래 불가");
    // 범위 조건이 없으면 끝까지 읽은 결과라 범위 안내가 없다.
    await expect(results).not.toContainText("찾은 페이지 안의 결과");
    await expect(results).not.toContainText("245");
    await expect(page.getByText(/출처/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("힘민지 범위 조건은 읽은 페이지 범위를 밝히고, 더 보기는 목록을 지운 채 기다리지 않는다", async ({ page }) => {
    await gotoReady(page, "/tools/accessory-search");
    await chooseOption(page, page.getByRole("combobox", { name: "힘민지 범위 최소" }), "70% 이상");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const results = page.getByRole("region", { name: "매물" });
    await expect(results).toContainText("찾은 페이지 안의 결과예요(3쪽 읽음)");
    const items = results.getByRole("listitem").filter({ hasText: "테스트 장신구" });
    await expect(items).toHaveCount(3);
    await page.getByRole("button", { name: "더 보기" }).click();
    await expect(items).toHaveCount(6);
    await expect(page.getByRole("button", { name: "더 보기" })).toHaveCount(0);
  });

  test("검색이 몰리면 남은 시간을 알리고 그동안 다시 검색을 막는다", async ({ page }) => {
    await gotoReady(page, "/tools/accessory-search");
    await chooseOption(page, page.getByRole("combobox", { name: "품질 최소" }), "90 이상");
    // The mock answers 503 for quality 99; the form only offers 50·70·90, so the
    // request is changed on its way out.
    await page.route("**/api/markets/accessory-search", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      await route.continue({ postData: JSON.stringify({ ...body, minQuality: 99 }) });
    });
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const alert = page.getByRole("region", { name: "매물" }).getByRole("alert");
    await expect(alert).toContainText("검색이 몰리고 있어요");
    await expect(alert.getByRole("button")).toHaveAttribute("aria-disabled", "true");
    await expect(alert.getByRole("button")).toContainText(/뒤 다시 검색/);
  });
});
