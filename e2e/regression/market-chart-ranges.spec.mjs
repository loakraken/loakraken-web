// 회귀(사용자 11-12, api #920): 시세 추이 기간은 1시간 · 7일 · 30일 · 3개월 · 1년(처음은 30일). 저장된 날이
// 모자라면 있는 날만 그리고 'N일치 기록'이라고 밝힌다(빈 날을 채우지 않음). 기간 조회 전 api(범위를 돌려주지
// 않음)면 지금처럼 1시간 · 7일 · 14일. 기간을 바꿔도 흔들림 0, 320에서 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const detailOf = (page) => page.locator("section").filter({ has: page.getByRole("heading", { name: "시세 추이" }) });

for (const width of [320, 1280])
  test(`${width}: 기간 1시간·7일·30일·3개월·1년, 모자란 기간은 있는 날만 'N일치 기록' @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
    const detail = detailOf(page);
    const ranges = detail.getByRole("group", { name: "기간" });
    await expect(ranges.getByRole("button")).toHaveText(["1시간", "7일", "30일", "3개월", "1년"]);
    await expect(ranges.getByRole("button", { name: "30일" })).toHaveAttribute("aria-pressed", "true");
    const caption = detail.getByText(/^하루 평균 거래가와 거래량/);
    // 30 days are all there (the mock keeps 45): no note.
    await expect(caption).toHaveText("하루 평균 거래가와 거래량");
    // 3개월: the mock has 39 completed days (45 kept, a 5-day hole, today partial), shown as they are and said.
    const moved = await shiftsDuring(page, () => ranges.getByRole("button", { name: "3개월" }).click(), 1500);
    await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 3개월 중 39일치 기록");
    await expect(detail.getByText(/공식 거래소 일별 통계와 LOAKraken 저장 기록/)).toBeVisible();
    await expect(detail.getByText(/^3개월 [▲▼]?\d+\.\d%$/)).toBeVisible();
    expect(moved.all, `3개월 전환 흔들림 (${moved.moved})`).toBe(0);
    await ranges.getByRole("button", { name: "1년" }).click();
    await expect(caption).toHaveText("하루 평균 거래가와 거래량 · 1년 중 39일치 기록");
    // The table lists the latest 14 days at most, whatever the range.
    await expect(detail.locator("table tbody tr")).toHaveCount(14);
    await ranges.getByRole("button", { name: "7일" }).click();
    await expect(caption).toHaveText("하루 평균 거래가와 거래량");
    await expect(detail.locator("table tbody tr")).toHaveCount(7);
    await expectNoHorizontalOverflow(page);
  });

test("기간 조회 전 api(range 없음)면 1시간·7일·14일 그대로 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  // The web's own route answers { ok, envelope }; drop the #920 fields as an older api would.
  await page.route(/\/api\/markets\/items\/\d+\/history/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    delete body.envelope.data.range;
    for (const variant of body.envelope.data.variants) {
      delete variant.recordedSince;
      delete variant.storedDays;
      variant.days = variant.days.slice(0, 14);
    }
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  // The first item came with the page (new api); another item is read through the old answer.
  await page.getByRole("region", { name: /각인서 시세/ }).getByRole("listitem").nth(1).getByRole("button").first().click();
  const ranges = detailOf(page).getByRole("group", { name: "기간" });
  await expect(ranges.getByRole("button")).toHaveText(["1시간", "7일", "14일"]);
  await expect(ranges.getByRole("button", { name: "14일" })).toHaveAttribute("aria-pressed", "true");
  await expect(detailOf(page).getByText("하루 평균 거래가와 거래량", { exact: true })).toBeVisible();
});

// api #920 (codex P2-1): for 30일+ the answer may also hold variants found only in stored history, after the
// official ones, with no trade terms (both null). They get their own button, never a second "1개".
test("기록에만 있는 거래 조건은 '지난 기록'으로 따로 고른다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.route(/\/api\/markets\/items\/\d+\/history\?range=90d/, async (route) => {
    const response = await route.fetch();
    const body = await response.json();
    const [official] = body.envelope.data.variants;
    const days = official.days.filter((d) => !d.partial).slice(10, 30);
    body.envelope.data.variants.push({ ...official, tradeRemainCount: null, bundleCount: null, days, storedDays: days.length, recordedSince: days.at(-1).date });
    await route.fulfill({ response, json: body });
  });
  await gotoReady(page, "/market?tab=ENGRAVING_BOOK");
  const detail = detailOf(page);
  await detail.getByRole("group", { name: "기간" }).getByRole("button", { name: "3개월" }).click();
  const terms = detail.getByRole("group", { name: "거래 조건" });
  await expect(terms.getByRole("button")).toHaveText(["1개", "지난 기록"]);
  await terms.getByRole("button", { name: "지난 기록" }).click();
  await expect(terms.getByRole("button", { name: "지난 기록" })).toHaveAttribute("aria-pressed", "true");
  // Its own 20 stored days: the table lists the latest 14 of them.
  await expect(detail.locator("table tbody tr")).toHaveCount(14);
  await expectNoHorizontalOverflow(page);
});
