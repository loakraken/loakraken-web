// 통계 B3 레벨별 전투력: 분포 탭 아래 5레벨 구간마다 전투력 중앙값을 잇는 선. 30명 미만 구간은 점 없이
// 축 위 옅은 표시(올리면 인원), 표로 보기에서는 구간마다 한 줄. 320·360·1280에서 점은 8px, 옆 넘침·흔들림 없음.
import { test, expect, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

const chart = (page) => page.getByRole("region", { name: "아이템 레벨별 전투력" });

for (const width of [1280, 360, 320])
  test(`통계 레벨별 전투력 @${width} @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    let answer;
    // A slow answer: the 180px box is held while it waits.
    await page.route("**/api/stats/level-combat-power?*", async (route) => {
      await new Promise((r) => setTimeout(r, 800));
      const response = await route.fetch();
      answer = await response.json();
      await route.fulfill({ response, json: answer });
    });
    await gotoReady(page, "/stats?tab=distribution");
    const box = chart(page).getByRole("img", { name: "아이템 레벨 구간별 전투력 중앙값" });
    await expect(box).toBeVisible();
    const buckets = answer.envelope.data.buckets;
    const drawn = buckets.filter((b) => b.median != null).length;
    expect(drawn, "중앙값 있는 구간").toBeGreaterThan(1);
    expect(drawn, "30명 미만 구간도 있음").toBeLessThan(buckets.length);
    // Every bucket has a mark with its hover text; a short one says why there is no point.
    const marks = box.locator("span[title]");
    await expect(marks).toHaveCount(buckets.length);
    const titles = await marks.evaluateAll((els) => els.map((el) => el.getAttribute("title")));
    expect(titles.filter((t) => t.includes("전투력 중앙값")).length).toBe(drawn);
    expect(titles.filter((t) => t.includes("명 미만이라 중앙값 없음")).length).toBe(buckets.length - drawn);
    // Points stay 8px at any width (the line stretches, the marks do not).
    const sizes = await box.evaluate((el) =>
      [...el.querySelectorAll("span[title]")].map((s) => Math.round(s.getBoundingClientRect().width)),
    );
    expect(Math.max(...sizes)).toBe(8);
    // The line itself: one path, drawn.
    await expect(box.locator("svg path")).toHaveCount(1);
    expect((await shiftsSince(page)).all, "선이 도착할 때 흔들림").toBe(0);
    await expectNoHorizontalOverflow(page);
    // 표로 보기: one row per bucket, '-' where there is no median.
    await page.getByRole("button", { name: "표로 보기" }).click();
    const rows = chart(page).getByRole("table", { name: "아이템 레벨 구간별 전투력 중앙값" }).locator("tbody tr");
    await expect(rows).toHaveCount(buckets.length);
    await expect(rows.first().locator("td").first()).toHaveText("-");
    await expectNoHorizontalOverflow(page);
  });
