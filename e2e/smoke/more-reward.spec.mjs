// 더보기 손익(/tools/more-reward, web #261).
// 더보기 골드는 공식 공지 기준 정적 자료다. 재료 가치는 목 서버 합성 시세라
// 값 자체가 아니라 화면 안의 관계(이득 = 받는 재료 가치 − 더보기 골드)를 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const gold = (text) => Number(text.replace(/[^\d−-]/g, "").replace("−", "-"));

test.describe("더보기 손익 @smoke", () => {
  test("레이드·난이도·관문 표를 보여 준다", async ({ page }) => {
    await gotoReady(page, "/tools/more-reward");
    await expect(page.getByRole("heading", { level: 1, name: "더보기 손익" })).toBeVisible();
    const table = page.getByRole("table", { name: "레이드·난이도·관문별 더보기 이득" });
    await expect(table.getByRole("rowheader").first()).toBeVisible();
    await expect(table.getByRole("button", { name: /^재료 입력 더보기 [\d,]+G$/ }).first()).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("관문을 열고 재료 수량을 넣으면 이득 = 재료 가치 − 더보기 골드", async ({ page }) => {
    await gotoReady(page, "/tools/more-reward");
    const row = page.getByRole("row", { name: /^세르카 하드/ });
    const open = row.getByRole("button").first();
    await open.click();
    await expect(open).toHaveAttribute("aria-expanded", "true");

    const detail = page.getByRole("cell", { name: /^세르카 하드 1관문/ });
    await expect(detail).toContainText("세르카 하드 1관문");
    const value = (term) => detail.locator("dt", { hasText: term }).locator("xpath=following-sibling::dd[1]");
    await expect(value("더보기 골드")).toHaveText("5,600G");

    await detail.getByRole("spinbutton", { name: "운명의 파괴석", exact: true }).fill("1000");
    await expect(value("받는 재료 가치")).not.toHaveText("0G");
    const cost = gold(await value("더보기 골드").innerText());
    const worth = gold(await value("받는 재료 가치").innerText());
    await expect(value("이득")).toHaveText(new RegExp(`^${(worth - cost).toLocaleString("ko-KR").replace("-", "[−-]")}G$`));
    // 결론 카드(피아식별 규칙): 누를 관문 수, 재료를 넣은 관문 수.
    await expect(page.getByText(/누를 더보기 \d+관문/)).toBeVisible();
    await expect(page.getByText(/재료를 넣은 1관문 중/)).toBeVisible();
  });
});
