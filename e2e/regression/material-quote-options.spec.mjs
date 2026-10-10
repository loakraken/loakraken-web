// 회귀: 재료 구매 견적의 카테고리 목록(/api/markets/options) 도착 전 검색.
// web #67: 목록 도착 후에도 "카테고리를 선택해 주세요."가 남아 화면이 모순됐다.
// web #95에서 "도착 후 이어서 검색"으로 고쳤다. 목록 요청 실패 시 대기 안내(web #112)는 #113에서 고쳤다.
import { test, expect } from "../support/fixtures.mjs";

/** options 응답을 잡아 두었다가 release()로 풀어 준다. fail이면 502로 응답한다. */
async function holdOptions(page, { fail = false } = {}) {
  let release;
  const gate = new Promise((resolve) => (release = resolve));
  await page.route("**/api/markets/options**", async (route) => {
    await gate;
    if (fail)
      await route.fulfill({
        status: 502,
        contentType: "application/json",
        json: { ok: false, error: { code: "LOST_ARK_API_ERROR", status: 502 } },
      });
    else await route.continue();
  });
  return () => release();
}

test.describe("재료 구매 견적 카테고리 로딩 @regression", () => {
  test("목록 도착 전 검색하면, 도착 뒤 이어서 검색하고 모순된 오류가 없다", async ({ page }) => {
    const release = await holdOptions(page);
    await page.goto("/tools/material-quote");
    const category = page.getByRole("combobox", { name: "카테고리" });
    await expect(category).toBeDisabled();

    await page.getByRole("textbox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page.getByRole("status").filter({ hasText: "카테고리 목록을 받는 대로 검색할게요." })).toBeVisible();

    release();
    await expect(category).toBeEnabled();
    await expect(category).not.toHaveValue("");
    await expect(page.getByRole("alert").filter({ hasText: "카테고리를 선택해 주세요." })).toHaveCount(0);
    // 기억해 둔 검색어로 이어서 검색한다(web #95).
    await expect(page.getByRole("button", { name: "합성 재련 재료 견적에 추가" })).toBeVisible();
    await expect(page.getByText("카테고리 목록을 받는 대로 검색할게요.")).toHaveCount(0);
  });

  test("목록 요청이 실패하면 '받는 대로 검색' 대기 안내를 지운다", async ({ page }) => {
    const release = await holdOptions(page, { fail: true });
    await page.goto("/tools/material-quote");
    await page.getByRole("textbox", { name: "재료 이름" }).fill("합성");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    await expect(page.getByText("카테고리 목록을 받는 대로 검색할게요.")).toBeVisible();

    release();
    // 실패 안내가 나온 뒤에는 오지 않을 목록을 기다린다는 안내가 없어야 한다.
    await expect(page.getByRole("combobox", { name: "카테고리" }).locator("option")).toHaveText(["카테고리 없음"]);
    await expect(page.getByText("카테고리 목록을 받는 대로 검색할게요.")).toHaveCount(0);
  });
});
