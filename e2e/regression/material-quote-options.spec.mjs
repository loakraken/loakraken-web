// 회귀: 재료 구매 견적에서 카테고리 목록이 늦게 도착할 때 검색하면,
// 목록 도착 후 선택란은 "재료 전체"를 보이는데 "카테고리를 선택해 주세요." 오류가 남는다.
// 화면 상태가 서로 모순되고 사용자는 고를 수 없던 항목을 고르라는 안내를 받는다.
import { test, expect } from "../support/fixtures.mjs";

test.describe("재료 구매 견적 카테고리 로딩 @regression", () => {
  test("목록 도착 전 검색해도, 도착 뒤 모순된 오류가 남지 않는다", async ({ page }) => {
    test.fail(true, "web #67: 목록 도착 후에도 '카테고리를 선택해 주세요.'가 남음. 고치면 이 줄을 지운다.");
    let release;
    const gate = new Promise((resolve) => (release = resolve));
    await page.route("**/api/markets/options**", async (route) => {
      await gate;
      await route.continue();
    });
    await page.goto("/tools/material-quote");
    const category = page.getByRole("combobox", { name: "카테고리" });
    await expect(category).toBeDisabled();

    await page.getByRole("textbox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("button", { name: "검색", exact: true }).click();

    release();
    await expect(category).toBeEnabled();
    await expect(category).not.toHaveValue("");
    // 기대: 목록 도착 전 검색은 막히거나(버튼 비활성·로딩 표시) 도착 후 이어서 실행된다.
    // 어느 쪽이든 카테고리가 선택된 상태에서 "선택해 주세요" 오류가 보이면 안 된다.
    await expect(page.getByRole("alert").filter({ hasText: "카테고리를 선택해 주세요." })).toHaveCount(0);
  });
});
