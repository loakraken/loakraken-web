// 전투력 시뮬레이터(/tools/combat-power, 백엔드 #240 계약 A단계).
// 목 서버: 보통 캐릭터는 모든 항목이 UNSUPPORTED(계산 준비 중),
// "전투력계산"은 합성 OK 값(게임 식 아님)으로 계산된 경로를 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("전투력 시뮬레이터 @smoke", () => {
  test("계산식 확인 전 항목은 숫자 없이 '계산 준비 중'으로 보여 준다", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("언새늘")}`);
    await expect(page.getByRole("heading", { level: 1, name: "전투력 시뮬레이터" })).toBeVisible();
    await page.getByRole("combobox", { name: "테스트 보석 레벨" }).selectOption("10");
    await expect(page.getByText("계산 준비 중")).toBeVisible();
    await expect(page.getByText(/바꾼 1개 항목은 계산식을 확인하고 있어/)).toBeVisible();
    await expect(page.getByText("12,345.67")).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("계산된 항목은 증가분과 함께 반영하고, 처음 값으로 되돌린다", async ({ page }) => {
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력계산")}`);
    await page.getByRole("combobox", { name: "투구 재련 단계" }).selectOption("22");
    const changes = page.getByRole("region", { name: "바꾼 것" });
    await expect(changes.getByText("+10.00")).toBeVisible();
    await expect(page.getByText("12,355.67")).toBeVisible();
    await page.getByRole("button", { name: "처음 값으로" }).click();
    await expect(page.getByText("아래에서 값을 바꾸면 바로 다시 계산해요.")).toBeVisible();
  });
});
