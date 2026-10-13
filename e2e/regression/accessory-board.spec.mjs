// 회귀(API 목록 #10 + 장신구 시세 표): 부위별 연마 효과 등급 조합의 최저가, 등급·역할·품질 바꾸기,
// 조합을 누르면 싼 매물(쪽 이동), 아직 못 읽은 칸은 '집계 중'. 매물이 와도 화면이 흔들리지 않는다.
import { test, expect, gotoReady, chooseOption } from "../support/fixtures.mjs";

for (const width of [1280, 360]) {
  test(`@장신구 ${width} 장신구 시세와 매물 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.addInitScript(() => {
      window.__shifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) window.__shifts.push({ v: entry.value, input: entry.hadRecentInput });
      }).observe({ type: "layout-shift", buffered: true });
    });
    await gotoReady(page, "/market/accessories");
    for (const [name, count] of [["목걸이", 8], ["귀걸이", 8], ["반지", 8]]) {
      const slot = page.getByRole("region", { name: new RegExp(`^${name}`) });
      await expect(slot.locator("li")).toHaveCount(count);
    }
    await expect(page.getByRole("region", { name: /^반지/ }).getByText("집계 중")).toHaveCount(1);
    // Prices, counts and change rates line up digit by digit (tabular numbers, computed).
    const numbers = await page.getByRole("region", { name: /^목걸이/ }).getByRole("button").first().evaluate((button) =>
      [...button.querySelectorAll("b, small")]
        .filter((el) => /\d/.test(el.textContent ?? ""))
        .map((el) => `${el.textContent.trim()} ${getComputedStyle(el).fontVariantNumeric}`),
    );
    expect(numbers.length, "숫자 칸").toBeGreaterThan(1);
    for (const line of numbers) expect(line, "고정폭 숫자").toContain("tabular-nums");

    // A7: from the first press on, shifts right after an input count too.
    const firstLoad = await page.evaluate(() => window.__shifts.reduce((a, e) => a + e.v, 0));
    expect(firstLoad, "첫 로드 layout-shift").toBe(0);
    await page.evaluate(() => (window.__shifts = []));
    await page.getByRole("button", { name: "적주피 상 · 추피 중 매물 보기" }).click();
    await expect(page).toHaveURL(/slot=NECKLACE&levels=HIGH%2CMID/);
    const listings = page.getByRole("table", { name: "장신구 매물" });
    await expect(listings.locator("tbody tr:not([aria-hidden])")).toHaveCount(10);
    await expect(listings.locator("tbody tr:not([aria-hidden])").first()).toContainText("적주피 상 · 추피 중");
    await page.getByRole("navigation", { name: "매물 쪽 이동" }).getByRole("button", { name: "2" }).click();
    await expect(listings.locator("tbody tr:not([aria-hidden])")).toHaveCount(2);

    await page.waitForTimeout(500);
    const moved = await page.evaluate(() => window.__shifts.reduce((a, e) => a + e.v, 0));
    expect(moved, "칸 누름·쪽 이동 뒤 layout-shift(입력 직후 포함)").toBe(0);
  });
}

test("장신구 시세: 서포터·유물·품질 무관으로 바꾸면 조합과 고른 칸이 바뀐다 @regression", async ({ page }) => {
  await gotoReady(page, "/market/accessories?slot=RING&levels=HIGH,MID");
  await expect(page.getByRole("button", { name: "치피 상 · 치적 중 매물 보기" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("group", { name: "역할" }).getByRole("button", { name: "서포터" }).click();
  await expect(page.getByRole("region", { name: /^귀걸이/ }).locator("li")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /매물 보기$/, pressed: true })).toHaveCount(0);
  await page.getByRole("group", { name: "등급" }).getByRole("button", { name: "유물" }).click();
  await chooseOption(page, page.getByRole("combobox", { name: "품질" }), "무관");
  await expect(page).toHaveURL(/grade=RELIC/);
  await expect(page).toHaveURL(/role=SUPPORT/);
  await expect(page).toHaveURL(/minQuality=0/);
});
