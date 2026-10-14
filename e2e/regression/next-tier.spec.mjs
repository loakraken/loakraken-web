// 회귀(L2 다음 티어까지): 순위 칸마다 다음 티어 이름과 남은 값(전투력·아이템 레벨). 다음 티어가
// 없는 칸(가장 높은 티어·표본 적음·그 티어 경계 없음)은 같은 높이로 비워 둔다.
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";
import { shiftsSince, watchShifts } from "../support/shifts.mjs";

for (const width of [1280, 360])
  test(`@L2 ${width} 순위 칸에 다음 티어까지 남은 값 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await watchShifts(page);
    await gotoReady(page, characterPath("상세"));
    const power = page.getByRole("region", { name: "전투력 순위" });
    await expect(power).toContainText("심해까지 전투력 7,281.49");
    await expect(power).toContainText("심해까지 전투력 3.17");
    const level = page.getByRole("region", { name: "아이템 레벨 순위" });
    await expect(level).toContainText("해구까지 아이템 레벨 6.25");
    await expect(level).toContainText("크라켄까지 아이템 레벨 4.00");
    // The top cell (already the top tier) keeps the line, empty: cells stand alike.
    const heights = await level.locator("li").evaluateAll((items) => items.map((li) => Math.round(li.getBoundingClientRect().height)));
    expect(new Set(heights).size, `칸 높이 ${heights.join(",")}`).toBe(1);
    await page.waitForTimeout(600);
    expect((await shiftsSince(page)).all, "첫 로드 흔들림").toBe(0);
  });
