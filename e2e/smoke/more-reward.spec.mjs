// 더보기 손익(/tools/more-reward, web #261).
// 더보기 골드와 관문별 재료·수량은 정적 자료(공식 공지 또는 서로 다른 실측 출처 2곳 일치)다.
// 재료 가치는 목 서버 합성 시세라 값 자체가 아니라 화면 안의 관계
// (이득 = 받는 재료 가치 − 더보기 골드)를 본다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const gold = (text) => Number(text.replace(/[^\d−-]/g, "").replace("−", "-"));

test.describe("더보기 손익 @smoke", () => {
  test("입력 없이 모든 관문을 판정하고, 설정은 접혀 있다", async ({ page }) => {
    await gotoReady(page, "/tools/more-reward");
    await expect(page.getByRole("heading", { level: 1, name: "더보기 손익" })).toBeVisible();
    // 사용자 23:27: 아무것도 안 눌러도 결론. 46관문 수량이 자료로 들어가 모든 관문이 판정된다.
    await expect(page.getByText(/누를 더보기 \d+관문/)).toBeVisible();
    await expect(page.getByText("전체 46관문 중")).toBeVisible();
    const table = page.getByRole("table", { name: "레이드·난이도·관문별 더보기 이득" });
    await expect(table.getByRole("button", { name: /^(추천 )?[+−][\d,]+ (누르기|넘기기) · / }).first()).toBeVisible();
    await expect(table.getByText("수량 확인 중")).toHaveCount(0);
    await expect(page.locator("details", { hasText: "고급 설정" })).not.toHaveAttribute("open", "");
    await expect(page.getByText(/1분마다 새로 불러와요/)).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test("관문을 열면 자료의 재료와 이득 = 재료 가치 − 더보기 골드를 보여 준다", async ({ page }) => {
    await gotoReady(page, "/tools/more-reward");
    const row = page.getByRole("row", { name: /^세르카 하드/ });
    const open = row.getByRole("button").first();
    await open.click();
    await expect(open).toHaveAttribute("aria-expanded", "true");

    const detail = page.getByRole("cell", { name: /^세르카 하드 1관문/ });
    const value = (term) => detail.locator("dt", { hasText: term }).locator("xpath=following-sibling::dd[1]");
    await expect(value("더보기 골드")).toHaveText("5,600G");
    // 계산 검증 9절: 세르카 하드 1관문 파괴석 결정 750.
    await expect(detail.locator("li", { hasText: "운명의 파괴석 결정" })).toContainText("×750");
    await expect(detail.getByRole("spinbutton")).toHaveCount(0);
    const cost = gold(await value("더보기 골드").innerText());
    const worth = gold(await value("받는 재료 가치").innerText());
    await expect(value("이득")).toHaveText(new RegExp(`^\\+?${(worth - cost).toLocaleString("ko-KR").replace("-", "[−-]")}G$`));
  });

  test("시세를 못 불러오면 결론 카드 안에서 알리고 다시 시도할 수 있다", async ({ page }) => {
    await page.route("**/api/markets/material-prices", (route) =>
      route.fulfill({ status: 502, json: { ok: false, error: { code: "LOST_ARK_API_ERROR", status: 502 } } }),
    );
    await gotoReady(page, "/tools/more-reward");
    const card = page.locator("[class*=verdict]").first();
    await expect(card.getByRole("alert")).toContainText("시세를 불러오지 못했어요");
    await expect(card.getByRole("button", { name: "시세 다시 불러오기" })).toBeVisible();
    await expect(card).not.toContainText("불러오고 있어요");
    // 시세가 없으면 칸은 판정하지 않고 더보기 골드만 보여 준다.
    await expect(page.getByRole("button", { name: /^[\d,]+G 더보기 골드$/ }).first()).toBeVisible();
  });

  test("시세가 모두 거의 0G면 모든 관문이 손해라고 말한다", async ({ page }) => {
    await page.route("**/api/markets/material-prices", async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      for (const item of body.envelope.data.items) if (item.unitPriceGold != null) item.unitPriceGold = 0.0001;
      await route.fulfill({ response, json: body });
    });
    await gotoReady(page, "/tools/more-reward");
    const card = page.locator("[class*=verdict]").first();
    await expect(card).toContainText("누를 더보기 0관문");
    await expect(card).toContainText("지금 시세로는 모든 관문이 손해예요");
  });
});
