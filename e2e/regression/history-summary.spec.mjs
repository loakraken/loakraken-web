// 회귀: 캐릭터 통계 탭 — 그래프마다 기간 머리('YY.MM.DD ~ 오늘 · N일')와 현재·최고·변화 3칸.
// 3칸은 불러오는 동안에도 자리를 잡고 있어 그래프가 밀리지 않는다(A6).
import { test, expect, characterPath, gotoReady } from "../support/fixtures.mjs";

test("통계 탭 그래프마다 기간과 현재·최고·변화 @regression", async ({ page }) => {
  await gotoReady(page, characterPath("상세", "stats"));
  for (const label of ["아이템 레벨", "전투력", "원정대 레벨"]) {
    const panel = page.getByRole("region", { name: label, exact: true });
    await expect(panel).toBeVisible();
    await expect(panel).toContainText(/\d{2}\.\d{2}\.\d{2} ~ 오늘 · [\d,]+일/);
    const cells = panel.locator("dl").first();
    await expect(cells.locator("dt")).toHaveText(["현재", "최고", "변화"]);
    await expect(cells.locator("dd").first()).not.toHaveText(/^\s*$/);
  }
});
