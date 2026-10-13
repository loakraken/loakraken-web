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

// A35: on a narrow screen the tab row shows at least two whole tabs and fades
// where more are hidden; share and favorite move into the menu (더보기).
for (const width of [360, 390])
  test(`분석 메뉴: ${width}에서 탭 두 개 이상 온전히·공유와 즐겨찾기는 더보기 안 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await gotoReady(page, characterPath("상세"));
    const nav = page.getByRole("navigation", { name: "캐릭터 정보 탭" });
    const box = await nav.boundingBox();
    const tabs = nav.getByRole("link");
    for (const i of [0, 1]) {
      const tab = await tabs.nth(i).boundingBox();
      expect(tab.x, `탭 ${i + 1} 시작`).toBeGreaterThanOrEqual(box.x);
      expect(tab.x + tab.width, `탭 ${i + 1} 끝이 보이는 폭 안 (${box.width}px)`).toBeLessThanOrEqual(box.x + box.width - 8);
    }
    // More tabs than fit: the far end fades (mask), the start does not yet.
    expect(await nav.evaluate((el) => getComputedStyle(el).maskImage)).toContain("linear-gradient");
    await expect(page.getByRole("button", { name: /^즐겨찾기/ })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "공유하기" })).toHaveCount(0);

    await page.getByRole("button", { name: "더보기" }).click();
    const menu = page.getByRole("menu");
    await expect(menu.getByRole("menuitem", { name: /^직업 통계/ })).toBeVisible();
    await expect(menu.getByRole("menuitem", { name: "공유하기" })).toBeVisible();
    await menu.getByRole("menuitem", { name: "즐겨찾기" }).click();
    await page.getByRole("button", { name: "더보기" }).click();
    await expect(page.getByRole("menu").getByRole("menuitem", { name: "즐겨찾기 해제" })).toBeVisible();
    await page.keyboard.press("Escape");
    await expectNoHorizontalOverflow(page);
  });

test("분석 메뉴: 넓은 화면은 공유·즐겨찾기가 탭 줄에, 메뉴는 분석만 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  await expect(page.getByRole("button", { name: "공유하기" })).toBeVisible();
  await page.getByRole("button", { name: "분석" }).click();
  await expect(page.getByRole("menu").getByRole("menuitem", { name: "공유하기" })).toHaveCount(0);
});
