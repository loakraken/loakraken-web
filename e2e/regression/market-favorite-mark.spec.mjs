// 회귀(사용자 11-02): 시세판에서 즐겨찾기한 품목은 즐겨찾기 줄뿐 아니라 시세 목록의 모든 줄에
// 표시가 있다. 표시는 그림 모서리에 얹혀 줄의 크기·글자 자리를 바꾸지 않고(흔들림 0),
// 읽히는 이름에 '즐겨찾기됨'이 붙는다. 분류를 오가도 남고, 빼면 사라진다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const rows = (page) => page.locator("section[aria-labelledby='board-heading'] li button");
const mark = (row) => row.locator("[data-starred]");
// The row's size and the name's place inside the row: relative to the row, so
// the detail panel loading above the board (narrow screens) does not count.
const box = (row) =>
  row.evaluate((el) => {
    const name = el.querySelector("strong").getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return [r.width, r.height, name.left - r.left, name.top - r.top, name.width, name.height].map(Math.round);
  });

for (const width of [1280, 360]) {
  test(`${width}: 즐겨찾기한 품목은 목록 줄에 표시, 흔들림 0, 분류를 오가도 남음 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market");
    const first = rows(page).first();
    await expect(first).toBeVisible();
    // The item name is the strong's first text node (the tier badge follows it).
    const name = (await first.locator("strong").evaluate((el) => el.firstChild.textContent)).trim();
    await expect(mark(first)).toHaveCount(0);
    await first.click();
    const before = await box(first);

    await page.getByRole("button", { name: "즐겨찾기에 추가" }).click();
    await expect(mark(first)).toBeVisible();
    await expect(first).toHaveAccessibleName(new RegExp(`· 즐겨찾기됨`));
    expect(await box(first), "표시가 생겨도 줄과 이름의 자리가 같다").toEqual(before);
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
