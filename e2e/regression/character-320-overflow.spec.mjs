// 회귀(PM-프론트 측정 10-25): 320에서 캐릭터 '통계' 탭(+12px, 기록 차트 칸 최소 320px)과 '원정대' 탭
// (+8px, 같은 폭 세 칸 숫자 요약)이 화면을 옆으로 넓혔다. 캐릭터 탭 모두 320에서 가로 넘침 0.
import { test, expect, characterPath, gotoReady, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

const TABS = ["combat", "simulator", "specup", "skills", "arkpassive", "collectibles", "avatars", "stats", "siblings", "guild", "evidence"];

for (const tab of TABS)
  test(`320 캐릭터 ${tab} 탭: 화면이 옆으로 넘치지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 844 });
    await gotoReady(page, characterPath("상세", tab));
    await expect(page.getByRole("navigation", { name: "캐릭터 정보 탭" })).toBeVisible();
    // Panels that load after the first paint (records, roster figures) count too.
    await page.waitForTimeout(800);
    await expectNoHorizontalOverflow(page);
  });

test("320 원정대 탭: 원정대 요약 숫자는 두 칸씩, 잘리지 않는다 @regression", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto(characterPath("상세", "siblings"));
  const stats = page.locator("dl[class*=rosterStats]");
  await expect(stats).toBeVisible();
  const cut = await stats.locator("dd").evaluateAll((dds) =>
    dds.filter((dd) => dd.scrollWidth > dd.clientWidth + 1 || dd.getBoundingClientRect().right > dd.parentElement.getBoundingClientRect().right + 0.5).map((dd) => dd.textContent),
  );
  expect(cut).toEqual([]);
});
