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
    /^대세 빌드 비교/,
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
  // Keys go to the menu only once focus is in it (a press before that went to the trigger).
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest("[role=menu]"))).toBe(true);
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

// A33·A15: on a phone the menu hangs centred under 더보기 (not stuck to the
// left edge), inside the screen, and never over the pinned header — at the
// top of the page and scrolled, on a short screen too.
for (const [width, height] of [
  [360, 800],
  [390, 844],
  [360, 640],
])
  for (const scrolled of [false, true])
    test(`더보기 메뉴: ${width}×${height} ${scrolled ? "스크롤한 뒤" : "첫 화면"} 트리거 가운데·헤더 아래 @regression`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await gotoReady(page, characterPath("상세"));
      if (scrolled) await page.mouse.wheel(0, 600);
      const trigger = page.getByRole("button", { name: "더보기" });
      await trigger.click();
      const menu = page.getByRole("menu");
      await expect(menu).toBeVisible();
      // Settled: the open transition scales from 0.98.
      await expect.poll(() => menu.evaluate((el) => el.getAnimations().length)).toBe(0);
      const t = await trigger.boundingBox();
      const m = await menu.boundingBox();
      const header = await page.locator("header[data-sticky-chrome]").boundingBox();
      expect(Math.abs(m.x + m.width / 2 - (t.x + t.width / 2)), "메뉴 가운데 = 트리거 가운데").toBeLessThanOrEqual(1);
      expect(m.x, "왼쪽 끝 화면 안").toBeGreaterThanOrEqual(12);
      expect(m.x + m.width, "오른쪽 끝 화면 안").toBeLessThanOrEqual(width - 12);
      expect(m.y, "헤더를 덮지 않음").toBeGreaterThanOrEqual(header.y + header.height);
      expect(m.y + m.height, "아래 끝 화면 안").toBeLessThanOrEqual(height - 12 + 0.5);
      // Every item can be reached: the list scrolls inside when it is cut.
      const last = menu.getByRole("menuitem").last();
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
    });

test("분석 메뉴: 넓은 화면은 공유·즐겨찾기가 탭 줄에, 메뉴는 분석만 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세"));
  await expect(page.getByRole("button", { name: "공유하기" })).toBeVisible();
  await page.getByRole("button", { name: "분석" }).click();
  await expect(page.getByRole("menu").getByRole("menuitem", { name: "공유하기" })).toHaveCount(0);
});
