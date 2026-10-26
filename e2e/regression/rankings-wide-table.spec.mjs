// 회귀(#1114): 넓은 화면(1440·1920)에서는 캐릭터 랭킹 표(11칸, 실제 값 기준 폭 약 1268px)가 좌우 스크롤 없이
// 한 번에 보인다. 좁은 화면은 표 상자 안에서만 스크롤하고, 화면은 어느 폭에서도 옆으로 넘치지 않는다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const scrolls = (page) =>
  page.getByRole("table").first().evaluate((table) => {
    const box = table.parentElement;
    return box.scrollWidth > box.clientWidth + 1;
  });

for (const width of [1440, 1920])
  test(`랭킹 ${width}: 표가 한 번에 보인다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/rankings");
    await expect(page.getByRole("table").first().getByRole("columnheader", { name: "에스더 무기" })).toBeVisible();
    expect(await scrolls(page), "표 좌우 스크롤").toBe(false);
    await expectNoHorizontalOverflow(page);
  });

for (const width of [320, 360, 390, 1280])
  test(`랭킹 ${width}: 화면은 넘치지 않는다(표는 제 상자 안에서) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/rankings");
    await expect(page.getByRole("table").first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
