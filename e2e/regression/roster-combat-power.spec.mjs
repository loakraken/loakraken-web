// 회귀(L19): 원정대 캐릭터별 전투력 — 기본 정렬은 전투력(기록 없음은 맨 아래), 식스맨·총합은
// 기록 있는 캐릭터 기준('n명 기준'), '전투력 불러오기'는 기록 없는 캐릭터가 있을 때만.
// 불러오는 동안 목록은 흐리게(A8), 기록이 오고 불러오기가 끝나도 화면이 흔들리지 않는다(A6·A7).
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const trackShifts = (page) =>
  page.addInitScript(() => {
    window.__shifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) window.__shifts.push({ v: entry.value, input: entry.hadRecentInput });
    }).observe({ type: "layout-shift", buffered: true });
  });
const quietShift = (page) =>
  page.evaluate(() => window.__shifts.filter((entry) => !entry.input).reduce((sum, entry) => sum + entry.v, 0));
const rows = (page) => page.locator("ul[class*=siblingGrid]").first().locator("li");

for (const width of [1280, 360]) {
  test(`@L19 ${width} 원정대 전투력: 정렬·식스맨·불러오기, 흔들림 0 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await trackShifts(page);
    await gotoReady(page, characterPath("원정대전투력", "siblings"));
    const power = page.getByRole("region", { name: "원정대 전투력" });
    await expect(power).toContainText("전투력 식스맨 평균 2,694.48");
    await expect(power).toContainText("총합 8,083.44");
    await expect(power).toContainText("(3명 기준)");

    // Combat power order; the two without a record at the bottom.
    await expect(rows(page).locator("strong")).toHaveText(["원정대전투력", "전투력넷", "전투력둘", "전투력셋", "전투력다섯"]);
    await expect(rows(page).nth(0)).toContainText(/전투력 3,180\.29 · 3시간 전 확인/);
    await expect(rows(page).nth(3)).toContainText("전투력 기록 없음");
    await expect(rows(page).nth(4)).toContainText("전투력 기록 없음");

    // The item level order is still one press away.
    await page.getByRole("radiogroup", { name: "원정대 정렬" }).getByRole("radio", { name: "아이템 레벨 순" }).click();
    await expect(rows(page).locator("strong")).toHaveText(["원정대전투력", "전투력둘", "전투력셋", "전투력넷", "전투력다섯"]);
    await page.getByRole("radiogroup", { name: "원정대 정렬" }).getByRole("radio", { name: "전투력 순" }).click();

    const button = power.getByRole("button", { name: "전투력 불러오기" });
    await expect(button).toBeVisible();
    await button.click();
    await expect(power.getByRole("button", { name: /불러오는 중…/ })).toHaveAttribute("aria-disabled", "true");
    await expect(page.locator("ul[class*=siblingGrid][data-stale]").first()).toBeVisible();
    await expect(power.getByText("전투력을 불러왔어요.")).toBeVisible();
    await expect(power.getByText("모든 캐릭터의 전투력 기록이 있어요.")).toBeVisible();
    await expect(power.getByRole("button")).toHaveCount(0);
    await expect(rows(page).locator("strong")).toHaveText(["원정대전투력", "전투력넷", "전투력셋", "전투력둘", "전투력다섯"]);
    await expect(page.getByText("전투력 기록 없음")).toHaveCount(0);
    await expect(power).toContainText("(5명)");

    await expectNoHorizontalOverflow(page);
    await page.waitForTimeout(500);
    expect(await quietShift(page), "기록 도착·불러오기 완료 뒤 layout-shift").toBe(0);
  });
}

test("@L19 불러오기 쿨다운: 오류처럼 보이지 않고 남은 시간 뒤 다시 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("전투력쿨다운", "siblings"));
  const power = page.getByRole("region", { name: "원정대 전투력" });
  await power.getByRole("button", { name: "전투력 불러오기" }).click();
  await expect(power.getByText("얼마 전에 불러왔어요. 잠시 뒤 다시 불러올 수 있어요.")).toBeVisible();
  await expect(power.getByRole("button", { name: /분.* 뒤 다시 불러오기/ })).toHaveAttribute("aria-disabled", "true");
});
