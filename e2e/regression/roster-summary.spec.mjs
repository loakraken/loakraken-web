// 회귀: 원정대 탭 요약 수치(캐릭터·평균·중앙값·최고·최저)와 구성 막대(아이템 레벨 구간·직업).
// 막대의 비율은 합이 정확히 100.0%다(잘못된 비율 표시 방지).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("원정대 요약 5칸과 구성 막대, 비율 합 100% @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "siblings"));
  const stats = page.locator('dl[aria-label="원정대 아이템 레벨"]');
  await expect(stats.locator("dt")).toHaveText(["캐릭터", "평균", "중앙값", "최고", "최저"]);
  for (const group of [page.getByRole("region", { name: "아이템 레벨 구간" }), page.getByRole("region", { name: /^직업 \d+개$/ })]) {
    await expect(group).toBeVisible();
    const values = await group.locator("li").evaluateAll((rows) =>
      rows.map((row) => Number((row.textContent.match(/([\d.]+)%/) ?? [])[1])),
    );
    expect(values.length).toBeGreaterThan(0);
    expect(Math.round(values.reduce((a, b) => a + b, 0) * 10)).toBe(1000);
  }
});
