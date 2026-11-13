// 회귀(사용자 11-12, api #920): 보석 · 장신구 칸을 고르면 매물 위에 그 칸의 '최저가 추이'(7일 · 30일 · 3개월 · 1년,
// 처음 30일). 기록이 모자란 기간은 있는 날만 그리고 'N일치 기록'. 칸을 고르기 전과 기간 기록을 못 읽을 때(기간
// 조회 전 api)도 같은 자리 상자라 아래가 움직이지 않는다. 장신구는 매물 아래에 그 부위의 등급 조합별 최저가 ·
// 전일 대비. 320에서 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsDuring, watchShifts } from "../support/shifts.mjs";

const trend = (page) => page.getByRole("region", { name: /최저가 추이$/ });
const CHART = /^그날 마지막으로 확인한 즉시 구매 최저가/;

for (const width of [320, 1280])
  test(`${width}: 보석 칸 최저가 추이, 기간 4개, 모자란 기간은 'N일치 기록' @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/market/gems?kind=겁화&level=10");
    const box = page.getByRole("region", { name: "10레벨 겁화 최저가 추이" });
    const ranges = box.getByRole("group", { name: "기간" });
    await expect(ranges.getByRole("button")).toHaveText(["7일", "30일", "3개월", "1년"]);
    await expect(ranges.getByRole("button", { name: "30일" })).toHaveAttribute("aria-pressed", "true");
    await expect(box.getByRole("img", { name: CHART })).toBeVisible();
    await expect(box.getByText("LOAKraken 기록(공식 일평균 아님)", { exact: false })).toBeVisible();
    const moved = await shiftsDuring(page, () => ranges.getByRole("button", { name: "3개월" }).click(), 1500);
    await expect(box.getByText("3개월 중 39일치 기록")).toBeVisible();
    expect(moved.all, `3개월 전환 흔들림 (${moved.moved})`).toBe(0);
    await expectNoHorizontalOverflow(page);
  });

test("칸을 고르기 전과 기간 기록을 못 읽을 때도 같은 자리 상자 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/market/gems");
  await expect(trend(page).getByText("위 표에서 칸을 고르면 그 칸의 최저가 추이를 보여 드려요.")).toBeVisible();
  await expect(trend(page).getByRole("button", { name: "30일" })).toBeDisabled();
  // An api before #920 has no such path: the box says so and the listings stand.
  await page.route(/\/api\/markets\/auctions\/gems\/history/, (route) =>
    route.fulfill({ status: 404, json: { ok: false, error: { code: "NOT_FOUND", status: 404 } } }),
  );
  await gotoReady(page, "/market/gems?kind=겁화&level=10");
  await expect(trend(page).getByText("기간 기록은 아직 준비 중이에요. 아래 매물은 지금 시세예요.")).toBeVisible();
  await expect(page.getByRole("heading", { name: /10레벨 겁화의 보석 매물/ })).toBeVisible();
});

for (const width of [320, 1280])
  test(`${width}: 장신구 칸 최저가 추이와 그 부위 등급 조합(최저가 · 전일 대비) @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/market/accessories?slot=NECKLACE&levels=HIGH,HIGH");
    await expect(trend(page).getByRole("img", { name: CHART })).toBeVisible();
    const combos = page.getByRole("region", { name: /등급 조합$/ });
    const rows = combos.locator("tbody tr");
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(1);
    // The picked combination is marked; every row has its lowest price.
    await expect(combos.locator('tbody tr[aria-current="true"]')).toHaveCount(1);
    await expect(rows.nth(0).locator("td").first()).toHaveText(/G$|-|집계/);
    // Another combination from the table picks it (the address follows).
    const other = combos.locator("tbody tr:not([aria-current]) button").first();
    const before = page.url();
    await other.click();
    await expect.poll(() => page.url()).not.toBe(before);
    await expect(combos.locator('tbody tr[aria-current="true"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
