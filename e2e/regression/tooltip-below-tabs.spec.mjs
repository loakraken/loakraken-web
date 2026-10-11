// 회귀: 아이템 상세 팝업을 연 채 스크롤해도 고정 헤더·탭 바를 덮지 않고, 기준 아이콘이
// 탭 바 밑으로 가려지면 팝업이 닫힌다(사용자 10-11 지적, PM-프론트 11:03 P1).
import { test, expect, characterPath } from "../support/fixtures.mjs";

test.use({ viewport: { width: 1440, height: 900 } });

test("상세 팝업은 스크롤 중 탭 바 아래에만 있고, 아이콘이 가려지면 닫힌다 @regression", async ({ page }) => {
  await page.goto(characterPath("상세", "combat"));
  const trigger = page.locator("[data-slot=item-tooltip-trigger]:visible").first();
  await trigger.scrollIntoViewIfNeeded();
  // 아이콘을 탭 바 바로 아래(화면 위쪽)로 올려 둔 뒤 클릭으로 연다.
  const chrome = () =>
    page.evaluate(() =>
      Math.max(0, ...[...document.querySelectorAll("[data-sticky-chrome]")].map((e) => e.getBoundingClientRect().bottom)),
    );
  const start = await trigger.boundingBox();
  await page.mouse.wheel(0, start.y - (await chrome()) - 80);
  await page.waitForTimeout(300);
  await trigger.click();
  const card = page.getByRole("dialog");
  await expect(card).toBeVisible();

  for (let step = 0; step < 40; step += 1) {
    await page.mouse.wheel(0, 20);
    await page.waitForTimeout(120);
    const state = await page.evaluate(() => {
      const bottom = Math.max(0, ...[...document.querySelectorAll("[data-sticky-chrome]")].map((e) => e.getBoundingClientRect().bottom));
      const popup = document.querySelector("[role=dialog]")?.getBoundingClientRect();
      return { bottom, top: popup ? popup.top : null };
    });
    if (state.top === null) break;
    // 열려 있는 동안 팝업 위 끝은 고정 영역 아래 끝보다 아래.
    expect(state.top).toBeGreaterThanOrEqual(state.bottom);
  }
  // 아이콘 가운데가 탭 바 밑으로 들어가면 닫혀 있다.
  const box = await trigger.boundingBox();
  expect(box.y + box.height / 2).toBeLessThan(await chrome());
  await expect(card).toHaveCount(0);
});
