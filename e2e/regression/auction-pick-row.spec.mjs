// 회귀: 경매 표 추천 줄(판매 손익 분기)의 왼쪽 막대가 글자와 겹치지 않는다. 1440·768·390.
// 사용자 발견(2026-10-10 23:24): 3px 막대가 칸 여백 0인 글자 위에 그려졌다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

test("추천 줄 막대와 글자 사이에 여백이 있다 @regression", async ({ page }) => {
  await gotoReady(page, "/tools/auction");
  await page.getByRole("textbox", { name: "아이템 가격 (거래소 최저가)" }).fill("100000");
  const row = page.locator("tbody tr[data-pick]");
  await expect(row).toHaveCount(1);
  const gap = await row.locator("th").evaluate((th) => {
    const cell = th.getBoundingClientRect();
    const range = document.createRange();
    range.selectNodeContents(th);
    const text = range.getBoundingClientRect();
    return text.left - cell.left;
  });
  // 막대 3px + 최소 여백.
  expect(gap).toBeGreaterThanOrEqual(8);
  // 다른 줄도 같은 위치에서 시작한다(열 정렬).
  const lefts = await page.locator("tbody tr th").evaluateAll((cells) =>
    cells.map((th) => {
      const range = document.createRange();
      range.selectNodeContents(th);
      return Math.round(range.getBoundingClientRect().left);
    }),
  );
  expect(new Set(lefts).size).toBe(1);
});
