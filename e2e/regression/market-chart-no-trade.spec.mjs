// 회귀(QA 11-15 04시 P2-2): 실제 각인서는 거래 조건이 둘(거래 1회 · 거래 0회)이고, 앞의 '거래 1회'는 모든 날이
// 평균가 0 · 거래 0이었다. 차트가 그 조건으로 열려 0G 직선(축 1 / 0 / −1)과 '0G · 0' 행 14개를 99,555G 머리
// 아래 보였다. 이제 거래가 가장 많은 조건으로 열고, 거래가 없는 조건을 고르면 0G 선 · 행 대신 거래가 없다고만 쓴다.
// codex #1671: 연 조건은 기간을 바꿔도 그대로(기간마다 답의 순서 · 거래 수가 다름), 거래가 하나도 없는 품목은 어느
// 기간이든 안내 한 번 · 표 자리 높이 그대로(흔들림 0).
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

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
    await expect(detail.getByText(/거래된 기록이 없어요/)).toHaveCount(1);
    await expect(detail.getByRole("img", { name: CHART })).toHaveCount(0);
    await expect(detail.locator(REAL_ROWS)).toHaveCount(0);
    await expect(detail.getByText(/^0G$/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

const HISTORY = /\/api\/markets\/items\/\d+\/history\?range=(30d|90d|365d)/;
const secondRow = (page) => page.locator('section[aria-labelledby="board-heading"] ul li button').nth(1);

for (const width of [320, 1280])
  test(`${width}: 거래가 하나도 없는 품목은 7일 · 30일 · 3개월 · 1년 모두 안내 한 번, 표 자리 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    // Every range's answer: one terms, every day 0 / 0 (the clicked row's history is the client's own fetch).
    await page.route(HISTORY, async (route) => {
      const response = await route.fetch();
      const body = await response.json();
      const [official] = body.envelope.data.variants;
      body.envelope.data.variants = [{ ...official, days: official.days.map((d) => ({ ...d, averagePrice: 0, tradeCount: 0 })) }];
      await route.fulfill({ response, json: body });
    });
    await watchShifts(page);
    await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
    const detail = detailOf(page);
    // The table's place: from the caption above it to the source line under it. The first item trades: its
    // 30일 table (14 rows) is the place every range but 7일 keeps (codex #1671: a header over 0 rows collapsed it).
    const place = async () => {
      const caption = await detail.getByText(/^하루 평균 거래가와 거래량/).boundingBox();
      const source = await detail.getByText(/공식 거래소 일별 통계/).boundingBox();
      return Math.round(source.y - (caption.y + caption.height));
    };
    const fullTable = await place();
    const opened = await shiftsDuring(page, () => secondRow(page).click(), 1500);
    expect(opened.all, `품목을 연 뒤 흔들림 (${opened.moved})`).toBe(0);
    const ranges = detail.getByRole("group", { name: "기간" });
    for (const range of ["30일", "7일", "3개월", "1년"]) {
      const moved = range === "30일" ? opened : await shiftsDuring(page, () => ranges.getByRole("button", { name: range }).click(), 1500);
      await expect(ranges.getByRole("button", { name: range })).toHaveAttribute("aria-pressed", "true");
      await expect(detail.getByText("이 조건으로는 거래된 기록이 없어요.", { exact: true }), range).toBeVisible();
      await expect(detail.getByText(/기록이 없어요/), `${range}: 안내는 한 번`).toHaveCount(1);
      await expect(detail.getByRole("img", { name: CHART })).toHaveCount(0);
      await expect(detail.locator(REAL_ROWS)).toHaveCount(0);
      expect(moved.all, `${range} 흔들림 (${moved.moved})`).toBe(0);
      if (range !== "7일") expect(await place(), `${range}: 표 자리(거래가 있는 품목 ${fullTable}px)`).toBe(fullTable);
    }
    await expectNoHorizontalOverflow(page);
  });

test("연 거래 조건은 기간을 바꿔도 그대로다(기간마다 거래 수 · 순서가 달라도) @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // 3개월: the opened terms trade most; 1년: other terms trade more and come first.
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=(90d|365d)/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const [official] = body.envelope.data.variants;
    const scaled = (v, k) => ({ ...v, days: v.days.map((d) => ({ ...d, tradeCount: Math.round(d.tradeCount * k) + 1 })) });
    const other = { ...official, tradeRemainCount: 1 };
    body.envelope.data.variants = route.request().url().includes("365d")
      ? [scaled(other, 4), scaled(official, 0.25)]
      : [scaled(official, 1), scaled(other, 0.5)];
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  const detail = detailOf(page);
  const ranges = detail.getByRole("group", { name: "기간" });
  const terms = detail.getByRole("group", { name: "거래 조건" });
  await ranges.getByRole("button", { name: "3개월" }).click();
  await expect(terms.getByRole("button", { name: "1개" })).toHaveAttribute("aria-pressed", "true");
  await ranges.getByRole("button", { name: "1년" }).click();
  await expect(terms.getByRole("button")).toHaveText(["거래 1회", "1개"]);
  await expect(terms.getByRole("button", { name: "1개" })).toHaveAttribute("aria-pressed", "true");
  // A press picks other terms, and they stay too.
  await terms.getByRole("button", { name: "거래 1회" }).click();
  await ranges.getByRole("button", { name: "3개월" }).click();
  await expect(terms.getByRole("button", { name: "거래 1회" })).toHaveAttribute("aria-pressed", "true");
});
