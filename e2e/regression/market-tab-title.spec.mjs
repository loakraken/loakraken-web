// 회귀(체크리스트 K36): 시세에서 고른 품목의 현재 최저가가 브라우저 탭 제목에 나온다(다른 탭에서도 보이게).
// 다른 품목을 고르면 제목도 그 품목 가격으로 바뀐다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// The item's own name: the row's <strong> also holds a tier mark (<i>T4</i>).
const nameOf = (row) => row.locator("strong").first().evaluate((el) => el.firstChild.textContent.trim());

test("시세: 고른 품목 가격이 탭 제목에 @regression", async ({ page }) => {
  await gotoReady(page, "/market");
  const board = page.getByRole("region", { name: /재련 재료 시세/ });
  const first = board.getByRole("listitem").first();
  await expect(page).toHaveTitle(new RegExp(`^[\\d,.]+G · ${escape(await nameOf(first))} \\| LOAKraken$`));

  const second = board.getByRole("listitem").nth(1);
  await second.getByRole("button").first().click();
  await expect(page).toHaveTitle(new RegExp(`^[\\d,.]+G · ${escape(await nameOf(second))} \\| LOAKraken$`));
});
