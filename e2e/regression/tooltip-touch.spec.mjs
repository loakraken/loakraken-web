// 회귀(web #1984, PM-프론트 11-28 다시 검토 #1940 P2): 설명 툴팁은 터치로도 열린다. 공용 툴팁은 마우스 올림 · 키보드
// 초점에서만 열리고 누르면 취소해서, 휴대폰에서는 용어의 설명을 볼 수 없었다. 터치 흉내(hasTouch · isMobile, 320)에서 초점이
// 아니라 누름(tap)으로: 누르면 열리고, 다시 누르면 닫히고, 바깥을 누르면 닫힌다. 보스 피해 환산(캐릭터 머리 · 시뮬레이터 띠),
// 팔찌 효율.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test.use({ hasTouch: true, isMobile: true, viewport: { width: 320, height: 800 } });

const NOTE =
  "아크 그리드 효율을 젬 옵션 ‘보스 피해’ 레벨로 바꿔 나타낸 값이에요. 보스 피해 1레벨을 1/12%로 보고 효율에 12를 곱해 셈해요.";
const tip = (page) => page.locator("[data-slot=tooltip-content]");

test("캐릭터 머리 보스 피해 환산: 누르면 열리고, 다시 누르면 · 바깥을 누르면 닫힌다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  const term = page.getByRole("button", { name: /^보스 피해 환산/ }).first();
  await term.tap();
  await expect(tip(page)).toHaveText(NOTE);
  await term.tap();
  await expect(tip(page)).toHaveCount(0);
  await term.tap();
  await expect(tip(page)).toHaveText(NOTE);
  // A tap away from it (the page heading area) closes it.
  await page.getByRole("heading", { level: 1 }).first().tap();
  await expect(tip(page)).toHaveCount(0);
});

test("시뮬레이터 결과 띠 보스 피해 환산: 누르면 열린다 @regression", async ({ page }) => {
  await gotoReady(page, `/tools/combat-power?character=${encodeURIComponent("전투력젬바꿈")}`);
  const term = page.getByText(/^지금 아크 그리드 효율/).getByRole("button", { name: /^보스 피해 환산/ });
  await term.tap();
  await expect(tip(page)).toHaveText(NOTE);
});

test("팔찌 효율: 누르면 열린다 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  await page.getByRole("button", { name: /^팔찌 효율/ }).tap();
  await expect(tip(page)).toBeVisible();
});
