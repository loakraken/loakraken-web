// 통계 B2 보석 레벨 분포: 분포 탭 아래 12구간('5 미만' ~ '10.0') 막대, 보석이 확인된 인원 기준 안내,
// 표로 보기에서는 같은 12줄. 320·360·1280에서 옆 넘침·흔들림이 없다(두 차트는 탭 맨 아래, 두 응답이 다 온 뒤 한꺼번에).
// api에 아직 없는 주소(404)면 두 차트는 흔적 없이 빠지고, 진짜 실패(503)만 그 자리에 다시 시도가 나온다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const chart = (page) => page.getByRole("region", { name: "보석 레벨 분포" });

for (const width of [1280, 360, 320])
  test(`통계 보석 레벨 분포 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // A slow answer: nothing is under the charts, so their late landing moves nothing.
    await page.route("**/api/stats/gem-levels?*", async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await gotoReady(page, "/stats?tab=distribution");
    const bars = chart(page).getByRole("list", { name: "보석 평균 레벨 구간별 인원" }).getByRole("listitem");
    await expect(bars).toHaveCount(12);
    await expect(bars.first()).toContainText("5 미만:");
    await expect(bars.last()).toContainText("10.0:");
    // Caption: the gem sample (the people whose gems were seen), out of the whole sample.
    const caption = chart(page).getByText(/보석이 확인된 .+명 기준이에요/);
    const gemSample = (await caption.textContent()).match(/보석이 확인된 ([\d,]+)명/)[1].replace(/,/g, "");
    expect(Number(gemSample)).toBeGreaterThan(0);
    // People in the bars = the gem sample.
    const people = (await bars.allTextContents()).reduce((sum, t) => sum + Number(t.split(":")[1].replace(/[^\d]/g, "")), 0);
    expect(people).toBe(Number(gemSample));
    expect((await shiftsSince(page)).all, "막대가 도착할 때 흔들림").toBe(0);
    await expectNoHorizontalOverflow(page);
    // 표로 보기: the same 12 bins as rows.
    await page.getByRole("button", { name: "표로 보기" }).click();
    await expect(chart(page).getByRole("table", { name: "보석 평균 레벨 구간별 인원" }).locator("tbody tr")).toHaveCount(12);
    await expectNoHorizontalOverflow(page);
  });

test("통계 보석 레벨 분포: 진짜 실패(503)면 그 자리에 다시 시도 @regression", async ({ page }) => {
  await page.route("**/api/stats/gem-levels?*", (route) =>
    route.fulfill({ status: 503, json: { ok: false, error: { code: "STATS_UNAVAILABLE", status: 503 } } }),
  );
  await gotoReady(page, "/stats?tab=distribution");
  await expect(chart(page).getByRole("button", { name: /다시 시도/ })).toBeVisible();
  // The other chart, answered, still shows.
  await expect(page.getByRole("region", { name: "아이템 레벨별 전투력" })).toBeVisible();
});

// PM-프론트 10-31: a web PR renders cleanly before its api ships. Today's api has neither endpoint.
for (const width of [1280, 360])
  test(`통계 분포: api에 두 주소가 없으면 차트 없음·오류 없음·흔들림 0 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    let asked = 0;
    await page.route(/\/api\/stats\/(gem-levels|level-combat-power)\?/, (route) => {
      asked++;
      return route.fulfill({ status: 404, json: { ok: false, error: { code: "NOT_FOUND", status: 404 } } });
    });
    await gotoReady(page, "/stats?tab=distribution");
    await expect.poll(() => asked).toBe(2);
    const panel = page.getByRole("tabpanel");
    // The main distribution and its basis note are there; the two charts are not, nor any error.
    await expect(panel.getByRole("list", { name: /구간별 인원/ }).first()).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("region", { name: "보석 레벨 분포" })).toHaveCount(0);
    await expect(page.getByRole("region", { name: "아이템 레벨별 전투력" })).toHaveCount(0);
    await expect(panel.getByRole("button", { name: /다시 시도/ })).toHaveCount(0);
    await expect(panel).not.toContainText("불러오지 못했어요");
    expect((await shiftsSince(page)).all, "흔들림").toBe(0);
    await expectNoHorizontalOverflow(page);
  });
