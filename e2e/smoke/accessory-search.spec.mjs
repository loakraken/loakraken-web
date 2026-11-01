// T4 장신구 매물 검색(/market/accessories/search, 체크리스트 N13, 백엔드 #431). 사용자 10-24에 성장 도구에서 시세로,
// 11-02에 장신구 시세와 한 탭(장신구)으로 합침: 화면 안의 '시세 · 매물 검색' 전환, 예전 주소는 308.
// 목 서버: 힘민지 범위 조건이면 1쪽은 일부(complete false, nextPage 4), 매물 중
// 하나는 입찰만, 하나는 거래 불가. 품질 99는 503 MARKET_SEARCH_BUSY(Retry-After 30).
import { test, expect, gotoReady, expectNoHorizontalOverflow, chooseOption } from "../support/fixtures.mjs";

test.describe("악세 경매 검색 @smoke", () => {
  test("조건으로 검색하면 즉시 구매가 순 매물과 연마 효과·거래 상태를 보여 준다", async ({ page }) => {
    await gotoReady(page, "/market/accessories/search");
    await expect(page.getByRole("heading", { level: 1, name: "장신구 매물 검색" })).toBeVisible();
    await chooseOption(page, page.getByRole("combobox", { name: "적에게 주는 피해 증가" }), "상 이상");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const results = page.getByRole("region", { name: "매물" });
    const items = results.getByRole("listitem").filter({ hasText: "테스트 장신구" });
    await expect(items).toHaveCount(3);
    await expect(items.nth(0)).toContainText("135만G");
    await expect(items.nth(0)).toContainText("적주피 2.00% 상");
    await expect(items.nth(1)).toContainText("입찰만 가능");
    await expect(items.nth(2)).toContainText("거래 불가");
    // 범위 조건이 없으면 끝까지 읽은 결과라 범위 안내가 없다.
    await expect(results).not.toContainText("찾은 페이지 안의 결과");
    await expect(results).not.toContainText("245");
    await expect(page.getByText(/출처/)).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("힘민지 범위 조건은 읽은 페이지 범위를 밝히고, 더 보기는 목록을 지운 채 기다리지 않는다", async ({ page }) => {
    await gotoReady(page, "/market/accessories/search");
    await chooseOption(page, page.getByRole("combobox", { name: "힘민지 범위 최소" }), "70% 이상");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const results = page.getByRole("region", { name: "매물" });
    await expect(results).toContainText("찾은 페이지 안의 결과예요(3쪽 읽음)");
    const items = results.getByRole("listitem").filter({ hasText: "테스트 장신구" });
    await expect(items).toHaveCount(3);
    await page.getByRole("button", { name: "더 보기" }).click();
    await expect(items).toHaveCount(6);
    await expect(page.getByRole("button", { name: "더 보기" })).toHaveCount(0);
  });

  test("검색이 몰리면 남은 시간을 알리고 그동안 다시 검색을 막는다", async ({ page }) => {
    await gotoReady(page, "/market/accessories/search");
    await chooseOption(page, page.getByRole("combobox", { name: "품질 최소" }), "90 이상");
    // The mock answers 503 for quality 99; the form only offers 50·70·90, so the
    // request is changed on its way out.
    await page.route("**/api/markets/accessory-search", async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}");
      await route.continue({ postData: JSON.stringify({ ...body, minQuality: 99 }) });
    });
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const alert = page.getByRole("region", { name: "매물" }).getByRole("alert");
    await expect(alert).toContainText("검색이 몰리고 있어요");
    await expect(alert.getByRole("button")).toHaveAttribute("aria-disabled", "true");
    await expect(alert.getByRole("button")).toContainText(/뒤 다시 검색/);
  });

  // 사용자 10-24: 매물 이름 끝의 화살표로 그 줄 바로 아래에 상세(아이템 그림·등급·품질·기본 효과·연마 효과·경매)를
  // 펼친다(아크 그리드 펼침과 같은 방식, 떠 있는 카드 없음). 검색 응답 값만 쓰고 요청을 더 보내지 않는다.
  test("매물 이름의 화살표로 줄 아래에 상세를 펼치고 접으며, 요청을 더 보내지 않는다", async ({ page }) => {
    await gotoReady(page, "/market/accessories/search");
    await chooseOption(page, page.getByRole("combobox", { name: "적에게 주는 피해 증가" }), "상 이상");
    await page.getByRole("button", { name: "검색", exact: true }).click();
    const results = page.getByRole("region", { name: "매물" });
    const rows = results.getByRole("listitem").filter({ hasText: "테스트 장신구" });
    await expect(rows).toHaveCount(3);
    let calls = 0;
    page.on("request", (r) => r.url().includes("/accessor") && calls++);
    // The name's own button (held by place: its expanded state changes below).
    const open = rows.first().locator("strong").getByRole("button");
    await expect(open).toHaveAttribute("aria-expanded", "false");
    // Points at its details only while they exist.
    await expect(open).not.toHaveAttribute("aria-controls", /.*/);
    // Hovering opens nothing (no pop-up cards while skimming the list).
    await open.hover();
    await page.waitForTimeout(400);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await open.click();
    await expect(open).toHaveAttribute("aria-expanded", "true");
    const detail = page.locator(`#${await open.getAttribute("aria-controls")}`);
    await expect(detail).toBeVisible();
    // Right below its own row's facts, inside that row.
    await expect(rows.first().locator(`#${await open.getAttribute("aria-controls")}`)).toHaveCount(1);
    await expect(detail).toContainText("연마 효과");
    await expect(detail).toContainText("즉시 구매가");
    await expect(detail).toContainText(/ 종료$/);
    // The item image (official CDN only).
    await expect(detail.locator("img")).toHaveAttribute("src", /^https:\/\/cdn-lostark\.game\.onstove\.com\//);
    await expect(page.getByRole("dialog")).toHaveCount(0);
    expect(calls).toBe(0);
    await open.press("Enter");
    await expect(open).toHaveAttribute("aria-expanded", "false");
    await expect(open).not.toHaveAttribute("aria-controls", /.*/);
    await expect(detail).toHaveCount(0);
    await expect(open).toBeFocused();
    await expectNoHorizontalOverflow(page);
  });

  test("예전 주소 둘(/tools/accessory-search, /market/accessory-search)은 조건을 그대로 새 주소로 한 번에 영구 이동(308)", async ({ request }) => {
    for (const old of ["/tools/accessory-search", "/market/accessory-search"]) {
      const response = await request.get(`${old}?slot=NECKLACE&q=1`, { maxRedirects: 0 });
      expect(response.status(), old).toBe(308);
      expect(response.headers()["location"], old).toMatch(/\/market\/accessories\/search\?slot=NECKLACE&q=1$/);
    }
  });

  test("장신구 탭 하나: 시세와 매물 검색은 화면 안의 전환(서버 HTML), 두 화면 모두 시세 탭 줄의 '장신구'가 지금 탭", async ({ page }) => {
    const views = page.getByRole("navigation", { name: "장신구 보기" });
    const hub = page.getByRole("navigation", { name: "시세 화면" });
    const html = await (await page.request.get("/market/accessories")).text();
    expect(html).toContain('aria-label="장신구 보기"');
    expect(html).toContain('href="/market/accessories/search"');
    await gotoReady(page, "/market/accessories");
    await expect(hub.getByRole("link", { name: "장신구", exact: true })).toHaveAttribute("aria-current", "page");
    // After the row is there (a flagged tab would join late): no separate search tab.
    await expect(hub.getByRole("link", { name: "악세 검색" })).toHaveCount(0);
    await expect(views.getByRole("link", { name: "시세" })).toHaveAttribute("aria-current", "page");
    await views.getByRole("link", { name: "매물 검색" }).click();
    await expect(page).toHaveURL(/\/market\/accessories\/search$/);
    await expect(page.getByRole("heading", { level: 1, name: "장신구 매물 검색" })).toBeVisible();
    await expect(views.getByRole("link", { name: "매물 검색" })).toHaveAttribute("aria-current", "page");
    // One screen: no way out to the tool list from inside the tab.
    await expect(page.getByRole("main").getByRole("link", { name: /도구 전체/ })).toHaveCount(0);
    await expect(hub.getByRole("link", { name: "장신구", exact: true })).toHaveAttribute("aria-current", "page");
    await expect(hub.locator('[aria-current="page"]')).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
});