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
    await expect(table.getByRole("button", { name: /^수량 확인 중 더보기 [\d,]+G · 재료 입력$/ }).first()).toBeVisible();
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
    // 결론 카드(피아식별 규칙): 누를 관문 수, 결론 난 관문 수(입력한 관문 + 고정 품목만으로 이득인 관문).
    await expect(page.getByText(/누를 더보기 \d+관문/)).toBeVisible();
    await expect(page.getByText(/결론 난 \d+관문 중/)).toBeVisible();
  });

  test("입력 없이도 고정 품목만으로 이득인 관문은 결론이 나고, 설정은 접혀 있다", async ({ page }) => {
    await gotoReady(page, "/tools/more-reward");
    // 사용자 23:27: 아무것도 안 눌러도 결론. 재련 재료를 빼고도 이득인 관문은 "최소" 하한으로 판정.
    await expect(page.getByText(/누를 더보기 [1-9]\d*관문/)).toBeVisible();
    await expect(page.getByRole("button", { name: /최소 \+[\d,]+ 누르기 · 재련 재료 빼고도 이득/ }).first()).toBeVisible();
    await expect(page.locator("details", { hasText: "고급 설정" })).not.toHaveAttribute("open", "");
    await expect(page.getByText(/1분마다 새로 불러와요/)).toBeVisible();
  });

  test("시세를 못 불러오면 결론 카드 안에서 알리고 다시 시도할 수 있다", async ({ page }) => {
    await page.route("**/api/markets/material-prices", (route) =>
      route.fulfill({ status: 502, json: { ok: false, error: { code: "LOST_ARK_API_ERROR", status: 502 } } }),
    );
    await gotoReady(page, "/tools/more-reward");
    const card = page.locator("[class*=verdict]");
    await expect(card.getByRole("alert")).toContainText("시세를 불러오지 못했어요");
    await expect(card.getByRole("button", { name: "시세 다시 불러오기" })).toBeVisible();
    await expect(card).not.toContainText("불러오고 있어요");
  });

  test("시세는 받았지만 확정 관문이 없으면 그렇게 말한다", async ({ page }) => {
    // 모든 재료가 거의 0G면 고정 품목만으로는 어느 관문도 이득이 확정되지 않는다.
    await page.route("**/api/markets/material-prices", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      for (const item of body.envelope.data.items) if (item.unitPriceGold != null) item.unitPriceGold = 0.0001;
      await route.fulfill({ response, json: body });
    });
    await gotoReady(page, "/tools/more-reward");
    const card = page.locator("[class*=verdict]");
    await expect(card).toContainText("고정 품목만으로 이득이 확정된 관문은 없어요");
    await expect(card).not.toContainText("불러오고 있어요");
  });
});
