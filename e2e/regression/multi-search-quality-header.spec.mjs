// 회귀(#1097): 멀티서치 '품질' 칸이 무엇의 품질인지 몰랐다. 머리글은 '장비 품질',
// 설명(툴팁)은 무기·방어구·장신구 평균이라고 말한다. 머리글·카드 이름은 잘리지 않는다.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const NOTE = /무기·방어구·장신구.*평균/;
/** Content wider than its box (cut or spilling), per element. */
const overflows = (locator) => locator.evaluateAll((els) => els.map((el) => el.scrollWidth > el.clientWidth));

test("멀티서치 1280: 품질 머리글이 무엇의 품질인지 말한다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/multi-search?names=비교1,비교2,비교3");
  const table = page.getByRole("region", { name: "캐릭터 비교 표" });
  await expect(table).toContainText("1,717.5");
  const header = table.getByRole("columnheader", { name: "장비 품질" });
  await expect(header).toHaveAttribute("title", NOTE);
  await expect(table.getByRole("columnheader", { name: /^품질/ })).toHaveCount(0);
  expect(await overflows(header), "머리글 넘침").toEqual([false]);
  // Sorting by it still works (and its arrow fits too).
  await header.getByRole("button").click();
  await expect(header).toHaveAttribute("aria-sort", /descending|ascending/);
  expect(await overflows(header), "정렬 화살표와 함께 넘침").toEqual([false]);
});

test("멀티서치 360: 카드의 품질 줄 이름도 같은 말과 설명 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await gotoReady(page, "/multi-search?names=비교1,비교2,비교3");
  const cards = page.getByRole("region", { name: "캐릭터 비교 카드" });
  await expect(cards).toContainText("1,717.5");
  const names = cards.locator("dt", { hasText: /^장비 품질$/ });
  await expect(names).toHaveCount(3);
  await expect(names.first()).toHaveAttribute("title", NOTE);
  expect(await overflows(names), "카드 줄 이름 잘림").toEqual([false, false, false]);
});
