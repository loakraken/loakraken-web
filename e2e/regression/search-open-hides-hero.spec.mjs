// 회귀(사용자 11-12, 휴대폰 홈): 머리말 검색을 열면 막대와 목록 사이 틈, 목록 아래로 홈 첫 화면의 큰 제목과
// 원래 검색 상자(파란 단추)가 비쳐 검색이 두 개처럼 보였다. 검색이 열려 있는 동안 첫 화면 내용은
// 숨기고(자리는 그대로, 흔들림 없음), 닫으면 다시 보인다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";
import { shiftMark, shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [320, 390])
  test(`${width}: 머리말 검색이 열려 있는 동안 홈 첫 화면 제목·검색 상자는 숨는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await watchShifts(page);
    await gotoReady(page, "/");
    const heading = page.locator("#hero-heading");
    const heroSearch = page.locator("#character-search");
    await expect(heading).toBeVisible();
    await expect(heroSearch).toBeVisible();
    const mark = await shiftMark(page);
    await page.locator('header[data-sticky-chrome] [data-slot="command-search-trigger"]').click();
    const dialog = page.getByRole("dialog", { name: "캐릭터 검색" });
    await expect(dialog).toBeVisible();
    // Hidden, not removed: the boxes stay where they were.
    await expect(heading).toBeHidden();
    await expect(heroSearch).toBeHidden();
    await expect(heading).toHaveCSS("visibility", "hidden");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(heading).toBeVisible();
    await expect(heroSearch).toBeVisible();
    const { all, moved } = await shiftsSince(page, mark);
    expect(all, `열고 닫는 동안 흔들림 (${moved})`).toBe(0);
  });

// Wider screens keep the hero when search opens (codex 11-13: phones only, ≤700px).
for (const width of [701, 1280])
  test(`${width}: 넓은 화면은 머리말 검색을 열어도 홈 첫 화면이 그대로 보인다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/");
    const heading = page.locator("#hero-heading");
    await expect(heading).toBeVisible();
    await page.locator('header[data-sticky-chrome] [data-slot="command-search-trigger"]').click();
    await expect(page.getByRole("dialog", { name: "캐릭터 검색" })).toBeVisible();
    await expect(heading).toHaveCSS("visibility", "visible");
    await page.keyboard.press("Escape");
  });
