// 회귀(사용자 11-08): 소개(/about) 머리글에는 소개 화면 자체의 '캐릭터 검색' 버튼이 없고(바로 아래 검색칸이 있음),
// 공용 검색 버튼의 'Ctrl K' 표시는 다른 화면과 같은 크기로 한 줄이다(소개 화면의 17px 글자가 넘어와 두 줄이 됐었음).
import { test, expect, gotoReady } from "../support/fixtures.mjs";

/** The shared search's shortcut label: its size and how many lines it takes. */
const shortcut = (page) =>
  page.locator('header[data-sticky-chrome] [data-slot="command-search-trigger"] kbd').evaluate((kbd) => {
    const range = document.createRange();
    range.selectNodeContents(kbd);
    return { size: getComputedStyle(kbd).fontSize, lines: new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size };
  });

test("1280 소개: 머리글에 화면 자체 검색 버튼 없음, Ctrl K 한 줄 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await gotoReady(page, "/");
  const home = await shortcut(page);
  await gotoReady(page, "/about");
  const header = page.locator("header[data-sticky-chrome]");
  // Only the shared search button carries the name in the header.
  await expect(header.getByRole("button", { name: "캐릭터 검색" })).toHaveCount(1);
  await expect(header.locator('[data-slot="command-search-trigger"]')).toBeVisible();
  const about = await shortcut(page);
  expect(about.lines, "Ctrl K 줄 수").toBe(1);
  expect(about.size, "Ctrl K 글자 크기(홈과 같음)").toBe(home.size);
  // The page's own search below stays.
  await expect(page.getByRole("textbox", { name: "캐릭터 이름" })).toBeVisible();
});
