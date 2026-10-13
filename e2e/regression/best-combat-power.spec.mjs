// 회귀(L5 최고 전투력 통계): 통계 화면 '최고 전투력' 탭 — 이력에서 가장 높았던 전투력의 전체 평균·
// 중앙값·상위 10%·최고와 직업별 표, 표본이 적은 칸은 인원만. 탭 전환·조건 전환 흔들림 0.
import { test, expect, gotoReady, chooseOption, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@L5 ${width} 최고 전투력 탭: 요약·직업별 표, 탭과 조건 전환 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/stats");
    await page.waitForTimeout(600);
    const tab = await shiftsDuring(page, () => page.getByRole("tab", { name: "최고 전투력" }).click());
    await expect(page).toHaveURL(/tab=best/);
    await expect(page.getByText(/최고 전투력 기록이 있는 [\d,]+명의, LOAKraken이 확인한 이력에서 가장 높았던 전투력이에요/)).toBeVisible();
    const table = page.getByRole("table", { name: "직업별 최고 전투력" });
    await expect(table.locator("tbody tr")).toHaveCount(27);
    // A class under the sample minimum: its count only.
    await expect(table.locator("tbody tr[data-short]").first()).toContainText("참고값");
    await expect(page.getByRole("img", { name: /^최고 전투력 하위 10%/ }).first()).toBeVisible();
    expect(tab.all, `탭 전환 흔들림 (${tab.moved})`).toBe(0);

    const short = await shiftsDuring(page, () => chooseOption(page, page.getByRole("combobox", { name: "서버" }), "니나브"), 1500);
    await expect(page.getByText(/표본이 30명 미만이라 값은 보여 드리지 않아요/)).toBeVisible();
    expect(short.all, `서버 전환 흔들림 (${short.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

test("@L5 최고 전투력 탭은 주소로 바로 열린다 @regression", async ({ page }) => {
  await watchShifts(page);
  await gotoReady(page, "/stats?tab=best");
  await expect(page.getByRole("tab", { name: "최고 전투력" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("table", { name: "직업별 최고 전투력" })).toBeVisible();
  await page.waitForTimeout(600);
  expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);
});
