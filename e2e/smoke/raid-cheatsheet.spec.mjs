// 레이드 컨닝페이퍼(/tools/raid-cheatsheet, 체크리스트 N20). 데이터는
// lib/tools/data/raid-cheatsheet.json, 화면에는 출처 없이 기준 시점만.
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

test.describe("레이드 컨닝페이퍼 @smoke", () => {
  test("레이드·난이도·관문을 고르면 패턴의 동작·대응·줄 구간을 보여 준다", async ({ page }) => {
    await gotoReady(page, "/tools/raid-cheatsheet");
    await expect(page.getByRole("heading", { level: 1, name: "레이드 컨닝페이퍼" })).toBeVisible();
    await chooseOption(page, page.getByRole("combobox", { name: "레이드" }), "고통의 마녀, 세르카");
    const gate = page.getByRole("region", { name: "1관문 · 세르카" });
    await expect(gate).toContainText("체스판");
    await expect(gate).toContainText("235줄");
    await page.getByRole("radio", { name: "2관문" }).click();
    await expect(page.getByRole("region", { name: "2관문 · 세르카" })).toContainText("285줄");
    await expect(page.getByText(/출처|인벤/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("줄 수가 자료마다 다른 관문은 숫자 없이 '줄 구간 정보 없음'이다", async ({ page }) => {
    await gotoReady(page, "/tools/raid-cheatsheet");
    await chooseOption(page, page.getByRole("combobox", { name: "레이드" }), "죽음의 계율자, 벨가르딘");
    await page.getByRole("radio", { name: "2관문" }).click();
    const gate = page.getByRole("region", { name: "2관문 · 페투스 안 크라그마" });
    await expect(gate.getByText("줄 구간 정보 없음").first()).toBeVisible();
    await expect(gate.getByText(/\d+줄/)).toHaveCount(0);
  });
});
