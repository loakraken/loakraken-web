// 시세: 분류·정렬·티어·페이지와 품목 추이 패널.
import { test, expect, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

test.describe("시세 @smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/market");
    await expect(page.getByRole("heading", { level: 1, name: "시세" })).toBeVisible();
  });

  test("기본 분류 보드와 첫 품목 추이를 보여 준다", async ({ page }) => {
    const categories = page.getByRole("tablist", { name: "시세 분류" });
    await expect(categories.getByRole("tab", { name: "재련 재료" })).toHaveAttribute("aria-selected", "true");
    const board = page.getByRole("region", { name: /재련 재료 시세 11종/ });
    await expect(board.getByRole("listitem")).toHaveCount(10);
    await expect(page.getByRole("heading", { name: "시세 추이" })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("분류를 바꾸면 보드가 바뀐다", async ({ page }) => {
    const categories = page.getByRole("tablist", { name: "시세 분류" });
    await categories.getByRole("tab", { name: "각인서" }).click();
    await expect(categories.getByRole("tab", { name: "각인서" })).toHaveAttribute("aria-selected", "true");
    await expect(page.getByRole("heading", { name: /각인서 시세 23종/ })).toBeVisible();
  });

  test("정렬·페이지를 바꾸고 품목을 고르면 추이 패널이 따라온다", async ({ page }) => {
    const sorts = page.getByRole("group", { name: "정렬" });
    await sorts.getByRole("button", { name: "고가" }).click();
    await expect(sorts.getByRole("button", { name: "고가" })).toHaveAttribute("aria-pressed", "true");
    const board = page.getByRole("region", { name: /재련 재료 시세/ });
    await expect(board.getByRole("listitem").first()).toContainText("운명의 파괴석 결정");

    await page.getByRole("navigation", { name: "페이지" }).getByRole("button", { name: "2" }).click();
    await expect(board.getByRole("listitem")).toHaveCount(1);

    const item = board.getByRole("listitem").first().getByRole("button");
    const name = (await item.locator("strong").innerText()).replace(/\s*T\d$/, "");
    await item.click();
    await expect(item).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("region", { name: `${name} 시세` })).toBeVisible();
  });

  test("기간 7일·14일을 전환한다", async ({ page }) => {
    const range = page.getByRole("group", { name: "기간" });
    await range.getByRole("button", { name: "7일" }).click();
    await expect(range.getByRole("button", { name: "7일" })).toHaveAttribute("aria-pressed", "true");
    await expect(range.getByRole("button", { name: "14일" })).toHaveAttribute("aria-pressed", "false");
  });
});
