// 회귀(M50, PM 총괄 11-22): 상점 교환 효율. 상점마다 재화 1개당 골드 가치 순위 — 거래소 품목은 시세(목 서버: 파괴석 결정
// 100개 900, 수호석 결정 190, 파괴석 80), 구성 · 확률이 공개되지 않은 상자와 시세 없는 품목은 내 값을 넣은 뒤에만 순위에
// 들고, 확인 중인 줄은 순위 밖. 모든 줄에 확인 날짜. 내 값은 입력을 마칠 때 반영(그전엔 순서가 그대로). 담기는 재화 ·
// 골드 가치 · 순이익을 더하고 주소에 남는다. 첫 로드 흔들림 0, 가로 넘침 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const guildList = (page) => page.getByRole("list", { name: "길드 혈석 교환 품목" });
const firstRow = (page) => guildList(page).getByRole("listitem").first();

for (const width of [320, 1280])
  test(`${width}: 상점 교환 효율 — 시세 품목 순위, 내 값 넣은 상자, 확인 중 줄, 담기 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, "/tools/shop-exchange");
    await expect(page.getByRole("heading", { level: 1, name: "상점 교환 효율" })).toBeVisible();

    // 레이드 재화 first: 24 rows, every one dated; boxes wait for a value.
    const raid = page.getByRole("list", { name: "레이드 재화 교환 품목" });
    await expect(raid.getByRole("listitem")).toHaveCount(24);
    await expect(raid.getByText(/확인 \d{4}-\d{2}-\d{2}/)).toHaveCount(24);
    await expect(raid.getByText("구성 · 확률 미공개").first()).toBeVisible();
    await page.waitForTimeout(600);
    const first = await shiftsSince(page);
    expect(first.all, `첫 로드 흔들림: ${first.moved}`).toBe(0);

    // 길드 혈석: the market rows rank first; 파괴석 결정 ×40 = 360 G for 690 → 0.52 G per 혈석.
    await page.getByRole("radiogroup", { name: "상점" }).getByRole("radio", { name: "길드 혈석" }).click();
    await expect(guildList(page).getByRole("listitem")).toHaveCount(29);
    await expect(firstRow(page)).toContainText("운명의 파괴석 결정");
    await expect(firstRow(page)).toContainText("360G");
    await expect(firstRow(page)).toContainText("재화 1개당 0.52G");
    // Rows being checked: shown, never ranked.
    const checking = guildList(page).getByRole("listitem").filter({ hasText: "확인 중" });
    await expect(checking).toHaveCount(8);
    await expect(checking.first().locator("span").first()).toHaveText("-");

    // A box value: typed (nothing moves yet), applied on Enter → 2,000 for 3,240 혈석 = 0.62 per 혈석, now first.
    const yoz = guildList(page).getByRole("textbox", { name: "요즈의 입장권 상자 1개(상자) 값(골드)" }).first();
    await yoz.fill("2000");
    await expect(firstRow(page)).toContainText("운명의 파괴석 결정");
    await yoz.press("Enter");
    await expect(firstRow(page)).toContainText("요즈의 입장권 상자");
    await expect(firstRow(page)).toContainText("2,000G");

    // Cart: 파괴석 결정 (690 혈석) twice → 1,380 혈석, 720 G; 혈석 has no market price, so the net is the same.
    await guildList(page).getByRole("button", { name: "운명의 파괴석 결정 690 실마엘 혈석 담기" }).click();
    const cart = page.getByRole("region", { name: "담은 교환" });
    await cart.getByRole("spinbutton", { name: "운명의 파괴석 결정 690 실마엘 혈석 교환 횟수" }).fill("2");
    await expect(page).toHaveURL(/[?&]cart=guild-11(%3A|:)2/);
    await expect(cart).toContainText("1,380개");
    await expect(cart.getByRole("definition").filter({ hasText: "G" }).first()).toBeVisible();
    await expect(cart).toContainText("720G");
    await expect(cart).toContainText("시세가 없는 재화(실마엘 혈석)는 0으로 셌어요");

    // Kept: the cart in the address, the value in this browser.
    await page.reload();
    await expect(firstRow(page)).toContainText("요즈의 입장권 상자");
    await expect(page.getByRole("region", { name: "담은 교환" })).toContainText("720G");
    await expectNoHorizontalOverflow(page);
  });

// codex P2 on #1928: on a switch to a basis not fetched yet, the previous basis's prices stand in until its own arrive;
// their arrival orders the list again, so the ranks never contradict the values on screen. Gold shows up to 2
// decimals, as on the market page.
test("1280: 시세 기준을 바꾸면 그 기준의 시세가 온 뒤 순서가 그 값을 따른다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // 최근 거래가: late, and 수호석 결정 at 50.1234 G (×40 = 2,004.94 G for 240 혈석 → 8.35 per 혈석, the top). The web's
  // own /api answers { ok, envelope }; the count proves the late answer is the changed one.
  let changed = 0;
  await page.route("**/api/markets/material-prices", async (route) => {
    const body = route.request().postDataJSON();
    if (body?.priceBasis !== "RECENT_PRICE") return route.continue();
    const response = await route.fetch();
    const json = await response.json();
    for (const item of json.envelope?.data?.items ?? [])
      if (item.name === "운명의 수호석 결정") {
        item.unitPriceGold = 50.1234;
        changed += 1;
      }
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.fulfill({ response, json });
  });
  await gotoReady(page, "/tools/shop-exchange?shop=guild");
  await expect(firstRow(page)).toContainText("운명의 파괴석 결정");
  await page.getByRole("radiogroup", { name: "시세 기준" }).getByRole("radio", { name: "최근 거래가" }).click();
  await expect.poll(() => changed, "최근 거래가 응답을 바꿈").toBeGreaterThan(0);
  await expect(firstRow(page)).toContainText("운명의 수호석 결정");
  await expect(firstRow(page)).toContainText("2,004.94G");
  await expect(firstRow(page).getByLabel("1위")).toBeVisible();
  await expect(page.getByText("재화 1개당 가치가 높은 순서예요.")).toBeVisible();
});

// codex P2 on #1928 (as #1889): text that is not a value stays as typed, marked invalid, and the saved value is kept.
test("320: 내 값에 '-100' · '1..2'를 넣으면 저장하지 않고 알려 준다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/tools/shop-exchange?shop=guild");
  const yoz = guildList(page).getByRole("textbox", { name: "요즈의 입장권 상자 1개(상자) 값(골드)" }).first();
  await yoz.fill("2000");
  await yoz.press("Enter");
  await expect(firstRow(page)).toContainText("2,000G");
  for (const bad of ["-100", "1..2"]) {
    await yoz.fill(bad);
    await yoz.press("Enter");
    await expect(yoz).toHaveAttribute("aria-invalid", "true");
    await expect(yoz).toHaveValue(bad);
    await expect(guildList(page).getByText("0보다 큰 숫자로 넣어 주세요. 넣은 값은 저장하지 않았어요.")).toBeVisible();
    await expect(firstRow(page)).toContainText("2,000G");
  }
  // Blur with the invalid text still there, then reload: the saved 2,000 stands.
  await yoz.blur();
  await page.reload();
  await expect(firstRow(page)).toContainText("요즈의 입장권 상자");
  await expect(firstRow(page)).toContainText("2,000G");
  await expectNoHorizontalOverflow(page);
});

// codex P2 on #1928: one item at two price steps (690 / 770 혈석) reads apart in the cart, by line and by name.
test("320: 같은 품목의 두 가격 줄을 담으면 담은 교환에서 서로 다르게 보인다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await gotoReady(page, "/tools/shop-exchange?shop=guild");
  for (const cost of ["690", "770"])
    await guildList(page).getByRole("button", { name: `운명의 파괴석 결정 ${cost} 실마엘 혈석 담기` }).click();
  const cart = page.getByRole("region", { name: "담은 교환" });
  for (const cost of ["690", "770"]) {
    await expect(cart.getByRole("spinbutton", { name: `운명의 파괴석 결정 ${cost} 실마엘 혈석 교환 횟수` })).toBeVisible();
    await expect(cart.getByRole("button", { name: `운명의 파괴석 결정 ${cost} 실마엘 혈석 빼기` })).toBeVisible();
    await expect(cart.getByText(`길드 혈석 · ${cost} 실마엘 혈석`)).toBeVisible();
  }
  await expectNoHorizontalOverflow(page);
});
