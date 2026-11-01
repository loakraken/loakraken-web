// 회귀(사용자 11-02): 시세판에서 즐겨찾기한 품목은 즐겨찾기 줄뿐 아니라 시세 목록의 모든 줄에
// 표시가 있다. 표시는 이름 앞의 채운 별(14px 이상, 눈에 띄는 크기, PM 화면 확인)이고 줄의 폭은
// 그대로, 읽히는 이름에 '즐겨찾기됨'이 붙는다. 분류를 오가도 남고, 빼면 사라진다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const rows = (page) => page.locator("section[aria-labelledby='board-heading'] li button");
const mark = (row) => row.locator("[data-starred]");

for (const width of [1280, 360]) {
  test(`${width}: 즐겨찾기한 품목은 목록 줄 이름 앞에 별, 분류를 오가도 남음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market");
    const first = rows(page).first();
    await expect(first).toBeVisible();
    // The item name is the strong's first text node (the tier badge follows it).
    const name = (await first.locator("strong").evaluate((el) => el.firstChild.textContent)).trim();
    await expect(mark(first)).toHaveCount(0);
    await first.click();
    const rowWidth = (await first.boundingBox()).width;

    await page.getByRole("button", { name: "즐겨찾기에 추가" }).click();
    await expect(mark(first)).toBeVisible();
    await expect(first).toHaveAccessibleName(new RegExp(`· 즐겨찾기됨`));
    // A star big enough to see, before the name's text, in the row's own width.
    const star = await first.evaluate((button) => {
      const strong = button.querySelector("strong");
      const svg = strong.querySelector("[data-starred]");
      const text = [...strong.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      const range = document.createRange();
      range.selectNodeContents(text);
      const s = svg.getBoundingClientRect();
      return { size: Math.round(s.width), beforeName: s.right <= range.getBoundingClientRect().left + 0.5 };
    });
    expect(star.size, "별 크기").toBeGreaterThanOrEqual(14);
    expect(star.beforeName, "별은 이름 앞").toBe(true);
    expect(Math.round((await first.boundingBox()).width), "줄 폭 그대로").toBe(Math.round(rowWidth));
    await expect(rows(page).locator("[data-starred]")).toHaveCount(1);

    // Another category and back: the mark comes back with the row.
    const tabs = page.getByRole("tablist", { name: "시세 분류" }).getByRole("tab");
    await tabs.nth(1).click();
    await expect(tabs.nth(1)).toHaveAttribute("aria-selected", "true");
    await tabs.nth(0).click();
    const again = rows(page).filter({ hasText: name }).first();
    await expect(mark(again)).toBeVisible();

    await again.click();
    await page.getByRole("button", { name: "즐겨찾기에서 빼기" }).click();
    await expect(mark(again)).toHaveCount(0);
    await expect(again).not.toHaveAccessibleName(/즐겨찾기됨/);
  });
}

// PM 화면 확인(11-02): 360 캡처에 보인 '본문으로 건너뛰기'는 캡처 탓인지 확인 — 키보드 초점일 때만 보인다.
test("360: 본문으로 건너뛰기는 초점일 때만 화면에 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, "/market");
  const skip = page.getByRole("link", { name: "본문으로 건너뛰기" });
  const hidden = await skip.boundingBox();
  expect(hidden.y + hidden.height, "초점 전에는 화면 위 밖").toBeLessThanOrEqual(0);
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  const shown = await skip.boundingBox();
  expect(shown.y, "초점이면 화면 안").toBeGreaterThanOrEqual(0);
});
