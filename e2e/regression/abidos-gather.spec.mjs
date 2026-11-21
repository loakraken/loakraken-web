// 회귀(PM 총괄 11-21 흡수 X5): 아비도스 제작 손익의 재료별 '직접 채집' — 고른 재료는 재료비 0골드(팔면 받을 값은 빼지 않음),
// 전체 켜기 · 끄기, 주소에 남아 새로고침해도 그대로. 목 시세(교환 상인 켬): 벌목 원가 33 × 7.5 + 45 × 1.5 + 86 × 0.6 + 400
// = 766.6 → '767'. 목재를 직접 채집하면 86 × 0.6이 빠져 715, 모두 채집하면 제작 골드 400만.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

async function openConditions(page) {
  const toggle = page.getByRole("button", { name: /^계산 조건/ });
  if (await toggle.isVisible()) {
    if ((await toggle.getAttribute("aria-expanded")) !== "true") await toggle.click();
  }
}

for (const width of [320, 1280])
  test(`${width}: 직접 채집 — 고른 재료는 0골드, 전체 켜기, 주소에 남음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await gotoReady(page, "/tools/abidos-craft");
    await openConditions(page);
    const normal = page.getByRole("region", { name: "아비도스 융화 재료", exact: true });
    const logging = normal.getByRole("row", { name: /^벌목/ });
    await expect(logging.getByRole("cell").nth(0)).toHaveText("767");

    // One material: 벌목's 목재.
    const box = page.getByRole("group", { name: "벌목 직접 채집" }).getByRole("checkbox", { name: "목재", exact: true });
    await box.check();
    await expect(logging.getByRole("cell").nth(0)).toHaveText("715");
    await expect(logging).toContainText("목재 86(채집)");
    await expect(page).toHaveURL(/gather=logging\.common/);
    if (width < 900) await expect(page.getByRole("button", { name: /^계산 조건/ })).toContainText("직접 채집 1개");

    // All of them: only the craft gold is left.
    const all = page.getByRole("switch", { name: "전체 직접 채집" });
    await all.click();
    await expect(all).toBeChecked();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(18);
    await expect(logging.getByRole("cell").nth(0)).toHaveText("400");

    // Kept in the address.
    await page.reload();
    await openConditions(page);
    await expect(page.getByRole("switch", { name: "전체 직접 채집" })).toBeChecked();
    await expect(page.getByRole("region", { name: "아비도스 융화 재료", exact: true }).getByRole("row", { name: /^벌목/ }).getByRole("cell").nth(0)).toHaveText("400");

    // Off again: back to the market cost.
    await page.getByRole("switch", { name: "전체 직접 채집" }).click();
    await expect(page.getByRole("checkbox", { checked: true })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "아비도스 융화 재료", exact: true }).getByRole("row", { name: /^벌목/ }).getByRole("cell").nth(0)).toHaveText("767");
    await expectNoHorizontalOverflow(page);
  });
