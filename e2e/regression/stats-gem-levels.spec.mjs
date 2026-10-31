// 통계 B2 보석 레벨 분포: 분포 탭 아래 12구간('5 미만' ~ '10.0') 막대, 보석이 확인된 인원 기준 안내,
// 표로 보기에서는 같은 12줄. 320·360·1280에서 옆 넘침·흔들림이 없고, 응답이 오기 전에도 자리를 잡아 둔다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const chart = (page) => page.getByRole("region", { name: "보석 레벨 분포" });

for (const width of [1280, 360, 320])
  test(`통계 보석 레벨 분포 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    // A slow answer: the section holds its place while it waits.
    await page.route("**/api/stats/gem-levels?*", async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      await route.continue();
    });
    await gotoReady(page, "/stats?tab=distribution");
    const bars = chart(page).getByRole("list", { name: "보석 평균 레벨 구간별 인원" }).getByRole("listitem");
    await expect(bars).toHaveCount(12);
    await expect(bars.first()).toContainText("5 미만:");
    await expect(bars.last()).toContainText("10.0:");
    // Caption: the gem sample, which is the summary card's 보석 count, out of the whole sample.
    const gemCard = await page.locator("dl > div").filter({ hasText: "보석 평균 레벨" }).locator("small").textContent();
    const gemSample = gemCard.replace(/[^\d]/g, "");
    await expect(chart(page).getByText(/보석이 확인된 .+명 기준이에요/)).toContainText(Number(gemSample).toLocaleString("ko-KR"));
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

test("통계 보석 레벨 분포: 응답이 없으면 그 자리에 다시 시도 @regression", async ({ page }) => {
  await page.route("**/api/stats/gem-levels?*", (route) =>
    route.fulfill({ status: 503, json: { ok: false, error: { code: "STATS_UNAVAILABLE", status: 503 } } }),
  );
  await gotoReady(page, "/stats?tab=distribution");
  await expect(chart(page).getByRole("button", { name: /다시 시도/ })).toBeVisible();
});
