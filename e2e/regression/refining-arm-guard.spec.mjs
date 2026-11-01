// 재련 기대 비용 완갑(사용자 11-02, api 완갑 PR): 완갑 줄은 0~25단계에 등급 칸이 없고,
// 요청은 ARM_GUARD(등급·책·성장 지원 없음, 완갑 숨결 스위치). '모든 부위 목표 단계'는 완갑을
// 바꾸지 않는다(단계표가 다름). 목 서버는 결정 재료·숨결 두 가지로 답한다.
import { test, expect, chooseOption, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const guardRow = (page) => page.getByRole("group", { name: "완갑", exact: true });

for (const width of [1280, 320])
  test(`${width}: 완갑 0→3을 고르면 ARM_GUARD로 묻고 결정 재료가 나오며, 화면이 넘치지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/tools/refining");
    const row = guardRow(page);
    await expect(row).toBeVisible();
    await expect(row.getByRole("combobox", { name: "등급" })).toHaveCount(0);
    await chooseOption(page, row.getByRole("combobox", { name: "현재" }), "+0");
    const asked = page.waitForRequest(
      (r) => r.url().includes("/api/refining/plans") && r.postDataJSON()?.equipmentType === "ARM_GUARD",
    );
    await page.getByRole("switch", { name: /완갑 숨결/ }).check();
    await chooseOption(page, row.getByRole("combobox", { name: "목표" }), "+3");
    const body = (await asked).postDataJSON();
    expect(body).toMatchObject({ equipmentType: "ARM_GUARD", fromStage: 0, toStage: 3, useBook: false, growthSupport: false });
    expect("grade" in body).toBe(false);
    const table = page.locator("table[data-wide]");
    await expect(table.getByRole("rowheader", { name: /^운명의 파괴석 결정/ })).toBeVisible();
    await expect(table.getByRole("rowheader", { name: /^빙하의 숨결/ })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

test("모든 부위 목표 단계 칩은 완갑 목표를 바꾸지 않는다 @regression", async ({ page }) => {
  await page.goto("/tools/refining");
  const row = guardRow(page);
  await expect(row.getByRole("combobox", { name: "목표" })).toHaveText(/\+18/);
  await page.getByRole("group", { name: "모든 부위 목표 단계" }).getByRole("button", { name: "+22" }).click();
  await expect(page.getByRole("group", { name: "무기", exact: true }).getByRole("combobox", { name: "목표" })).toHaveText(/\+22/);
  await expect(row.getByRole("combobox", { name: "목표" })).toHaveText(/\+18/);
});
