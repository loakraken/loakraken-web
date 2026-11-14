// 회귀(QA 11-15 04시 P2-2): 실제 각인서는 거래 조건이 둘(거래 1회 · 거래 0회)이고, 앞의 '거래 1회'는 모든 날이
// 평균가 0 · 거래 0이었다. 차트가 그 조건으로 열려 0G 직선(축 1 / 0 / −1)과 '0G · 0' 행 14개를 99,555G 머리
// 아래 보였다. 이제 거래가 가장 많은 조건으로 열고, 거래가 없는 조건을 고르면 0G 선 · 행 대신 거래가 없다고만 쓴다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const REAL_ROWS = "table:not([aria-hidden]) tbody tr";
const detailOf = (page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "시세 추이" }) });
const CHART = /^일 평균 거래가와 거래량/;

for (const width of [320, 1280])
  test(`${width}: 거래가 없는 조건이 앞에 있어도 거래가 있는 조건으로 열고, 0G 선 · 행을 그리지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // The real 각인서 answer: a no-trade series first (every day 0 / 0), the traded one after it.
    await page.route(/\/api\/markets\/items\/\d+\/history\?range=90d/, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const [official] = body.envelope.data.variants;
      const none = { ...official, tradeRemainCount: 1, days: official.days.map((d) => ({ ...d, averagePrice: 0, tradeCount: 0 })) };
      body.envelope.data.variants = [none, { ...official, tradeRemainCount: 0 }];
      await route.fulfill({ response, json: body });
    });
    await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
    const detail = detailOf(page);
    await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "3개월" }).click();
    const terms = detail.getByRole("group", { name: "거래 조건" });
    await expect(terms.getByRole("button")).toHaveText(["거래 1회", "거래 0회"]);
    // Opens on the terms that trade.
    await expect(terms.getByRole("button", { name: "거래 0회" })).toHaveAttribute("aria-pressed", "true");
    await expect(detail.getByRole("img", { name: CHART })).toBeVisible();
    await expect(detail.locator(REAL_ROWS).first()).toBeVisible();
    await expect(detail.locator(REAL_ROWS).locator("td", { hasText: /^0G$/ })).toHaveCount(0);
    // The no-trade terms: no line, no 0G rows — one plain note.
    await terms.getByRole("button", { name: "거래 1회" }).click();
    await expect(terms.getByRole("button", { name: "거래 1회" })).toHaveAttribute("aria-pressed", "true");
    await expect(detail.getByText("이 조건으로는 거래된 기록이 없어요. 다른 거래 조건을 골라 보세요.", { exact: true })).toBeVisible();
    await expect(detail.getByRole("img", { name: CHART })).toHaveCount(0);
    await expect(detail.locator(REAL_ROWS)).toHaveCount(0);
    await expect(detail.getByText(/^0G$/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
