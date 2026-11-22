// 회귀(X2, web #1939, PM 총괄 11-22 13:47): 아크 그리드 효율의 보스 피해 환산 Lv. 우리 실 효율(api #520) × 12를 우리 이름과
// 설명으로 보인다 — 캐릭터 화면의 아크 그리드 효율 옆, 시뮬레이터 결과 띠의 '지금' 줄. 효율을 계산하지 않았으면 레벨도 없다.
// 첫 로드 흔들림 0, 320에서 가로 넘침 없음.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const NOTE =
  "아크 그리드 효율을 젬 옵션 ‘보스 피해’ 레벨로 바꿔 나타낸 값이에요. 보스 피해 1레벨을 1/12%로 보고 효율에 12를 곱해 셈해요.";
const head = (page) => page.getByRole("button", { name: /^아크 그리드 효율/ }).locator("xpath=ancestor::p[1]");

for (const width of [320, 1280])
  test(`${width}: 캐릭터 화면 — 효율 옆에 보스 피해 환산 Lv, 설명은 우리 말 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    // 4.67% × 12 = 56.04.
    await expect(head(page)).toContainText("+4.67%");
    await expect(head(page)).toContainText("보스 피해 환산");
    await expect(head(page)).toContainText("Lv 56.04");
    const term = head(page).getByRole("button", { name: /^보스 피해 환산/ });
    await expect(term).toHaveAccessibleName(`보스 피해 환산: ${NOTE}`);
    await term.focus();
    await expect(page.locator("[data-slot=tooltip-content]")).toHaveText(NOTE);
    await page.waitForTimeout(600);
    const first = await shiftsSince(page);
    expect(first.all, `첫 로드 흔들림: ${first.moved}`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

test("1280: 효율을 계산하지 않은 캐릭터에는 레벨이 없다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, characterPath("효율준비중"));
  await expect(head(page)).toContainText("준비 중");
  await expect(head(page)).not.toContainText("보스 피해 환산");
});

for (const width of [320, 1280])
  test(`${width}: 시뮬레이터 결과 띠에 지금 아크 그리드 효율과 보스 피해 환산 Lv @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력젬바꿈")}`);
    // 5.02% × 12 = 60.24.
    const line = page.getByText(/^지금 아크 그리드 효율/);
    await expect(line).toHaveText("지금 아크 그리드 효율 +5.02% · 보스 피해 환산 Lv 60.24");
    // The note on its term, reachable by keyboard (not a title attribute).
    const term = line.getByRole("button", { name: /^보스 피해 환산/ });
    await expect(term).toHaveAccessibleName(`보스 피해 환산: ${NOTE}`);
    await term.focus();
    await expect(page.locator("[data-slot=tooltip-content]")).toHaveText(NOTE);
    await page.keyboard.press("Escape");
    // A character without one (the simulator's other mocks): no line.
    await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력코어도약")}`);
    await expect(page.getByText(/지금 아이템 레벨/)).toBeVisible();
    await expect(page.getByText(/^지금 아크 그리드 효율/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
