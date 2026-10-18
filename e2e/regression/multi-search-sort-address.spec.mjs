// QA v0.3.1 P1-2: the compare table's order (보석 header, its arrow) was lost
// after a character page and back, or a reload. The order now rides in the
// address (?sort=) next to the names, like the list itself.
import { test, expect, gotoReady } from "../support/fixtures.mjs";

const table = (page) => page.getByRole("region", { name: "캐릭터 비교 표" });
const gemsHeader = (page) => table(page).getByRole("columnheader", { name: "보석" });
const order = (page) => table(page).getByRole("rowheader").locator("a").allTextContents();

test("멀티서치: 정렬은 캐릭터 화면에서 뒤로 와도, 새로고침해도, 이름을 더해도 남는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/multi-search?names=비교1,비교2,비교3");
  await expect(page.getByText("3명을 비교하고 있어요")).toBeVisible();
  await expect(table(page)).toContainText("1,717.5");

  // First press: high to low. Second: low to high.
  await gemsHeader(page).getByRole("button").click();
  await gemsHeader(page).getByRole("button").click();
  await expect(gemsHeader(page)).toHaveAttribute("aria-sort", "ascending");
  await expect(page).toHaveURL(/[?&]sort=gems-asc(&|$)/);
  const sorted = await order(page);

  await table(page).getByRole("link", { name: sorted[0] }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/[?&]sort=gems-asc(&|$)/);
  await expect(gemsHeader(page)).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(() => order(page)).toEqual(sorted);

  await page.reload();
  await expect(gemsHeader(page)).toHaveAttribute("aria-sort", "ascending");
  await expect.poll(() => order(page)).toEqual(sorted);

  // Adding a name keeps the order and the names in one address.
  await page.getByRole("textbox", { name: "캐릭터 이름" }).fill("비교5");
  await page.getByRole("button", { name: "비교하기" }).click();
  await expect(page.getByText("4명을 비교하고 있어요")).toBeVisible();
  await expect(page).toHaveURL(/names=[^&]*%EB%B9%84%EA%B5%905/);
  await expect(page).toHaveURL(/[?&]sort=gems-asc(&|$)/);
  await expect(gemsHeader(page)).toHaveAttribute("aria-sort", "ascending");
});

test("멀티서치: 공유 주소의 정렬로 바로 열리고, 모르는 정렬 값은 무시한다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await gotoReady(page, "/multi-search?names=비교1,비교2,비교3&sort=itemLevel-desc");
  await expect(table(page).getByRole("columnheader", { name: "아이템 레벨" })).toHaveAttribute("aria-sort", "descending");
  await expect.poll(async () => (await order(page))[0]).toBe("비교3"); // 아이템 레벨이 가장 높다
  await gotoReady(page, "/multi-search?names=비교1,비교2,비교3&sort=name-sideways");
  await expect(page.getByText("3명을 비교하고 있어요")).toBeVisible();
  await expect(table(page).locator('th[aria-sort="ascending"], th[aria-sort="descending"]')).toHaveCount(0);
});
