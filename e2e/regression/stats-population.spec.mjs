// 통계 B5 전체 인구: '전체 인구' 탭(서버별 · 직업별 · 레벨별), 'LOAKraken이 확인한 모든 캐릭터 기준'과
// 집계 기준일. 첫 집계 전에는 '준비 중' 안내만(오류 아님). 320·360·1280에서 옆 넘침이 없다.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const panel = (page) => page.getByRole("tabpanel");

for (const width of [1280, 360, 320])
  test(`통계 전체 인구 탭 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await gotoReady(page, "/stats?tab=population");
    await expect(page.getByRole("tab", { name: "전체 인구" })).toHaveAttribute("aria-selected", "true");
    await expect(panel(page)).toContainText("LOAKraken이 확인한 모든 캐릭터 기준");
    await expect(panel(page)).toContainText("집계 기준 2026년 10월 31일");
    const views = panel(page).getByRole("group", { name: "전체 인구 보기" }).getByRole("button");
    await expect(views).toHaveText(["서버별", "직업별", "레벨별"]);
    // 서버별: every server, counts summing to the caption's number.
    const rows = panel(page).getByRole("listitem");
    await expect(rows).toHaveCount(8);
    const counts = (await rows.allTextContents()).map((t) => Number(t.match(/([\d,]+)명/)[1].replace(/,/g, "")));
    const caption = Number((await panel(page).getByText(/집계 기준/).textContent()).match(/([\d,]+)명/)[1].replace(/,/g, ""));
    expect(counts.reduce((a, b) => a + b, 0)).toBe(caption);
    await expectNoHorizontalOverflow(page);
    // 직업별: class rows with their icons.
    await views.nth(1).click();
    await expect(views.nth(1)).toHaveAttribute("aria-pressed", "true");
    await expect(rows.first()).toContainText("바드");
    await expectNoHorizontalOverflow(page);
    // 레벨별: at most 40 bars, the empty levels between included (no jump across a gap).
    await views.nth(2).click();
    const bars = panel(page).getByRole("list", { name: /아이템 레벨 구간별 인원/ }).getByRole("listitem");
    const n = await bars.count();
    expect(n).toBeGreaterThan(10);
    expect(n).toBeLessThanOrEqual(40);
    await expect(bars.filter({ hasText: /: 0명$/ }).first()).toBeAttached();
    await expectNoHorizontalOverflow(page);
  });

test("통계 전체 인구: 첫 집계 전에는 준비 중 안내만 @regression", async ({ page }) => {
  await page.route("**/api/stats/population*", (route) =>
    route.fulfill({
      json: {
        ok: true,
        envelope: { code: "STATS_POPULATION_SUCCESS", message: "", data: { snapshotDate: null, server: null, total: 0, servers: [], classes: [], levels: [] } },
      },
    }),
  );
  await gotoReady(page, "/stats?tab=population");
  await expect(panel(page)).toContainText("첫 집계를 준비 중이에요 · 매주 새벽에 집계해요");
  await expect(panel(page).getByRole("group", { name: "전체 인구 보기" })).toHaveCount(0);
});
