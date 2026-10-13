// 회귀(캐릭터 화면 전수표 §14.1 ③): 탭 줄 오른쪽 '분석' 메뉴 — 이 캐릭터를 받는 도구 목록.
// 키보드로 열고 고르며, 도구는 캐릭터 이름을 채운 채 열린다. 360에서도 탭 줄이 넘치지 않는다.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test("분석 메뉴: 항목과 이동 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  const trigger = page.getByRole("button", { name: "분석" });
  await trigger.click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    /^스펙업 계산/,
    /^전투력 시뮬레이터/,
    /^치적·뭉가·음돌/,
    /^캐릭터 비교/,
    /^직업 통계/,
  ]);
  await menu.getByRole("menuitem", { name: /^캐릭터 비교/ }).click();
  await expect(page).toHaveURL(/\/multi-search\?names=%EC%83%81%EC%84%B8$/);
});

test("분석 메뉴: 키보드로 열어 같은 화면의 탭으로 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  await page.getByRole("button", { name: "분석" }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(/[?&]tab=(specup|simulator)/);
});

test("분석 메뉴: 360에서 탭 줄 넘침 없음 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, characterPath("상세"));
  await expect(page.getByRole("button", { name: "분석" })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
