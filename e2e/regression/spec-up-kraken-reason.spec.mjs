// 회귀(api #1042, #1861): 크라켄 점수 목록에서 계산됐지만 Δ점수가 없는 빈 보석 칸 줄은 api가 준 까닭 문장으로 접힌다.
// 필드가 없는 답(배포 전 api)은 웹 문장 그대로(#1854, spec-up-list-real-v0315). 효율 목록에서는 이 줄이 늘 순위에 있다.
import { test, expect, characterPath } from "../support/fixtures.mjs";

const API_REASON = "빈 보석 칸은 넣을 스킬이 정해지지 않아 크라켄 점수를 매기지 않아요.";

for (const width of [320, 1280]) {
  test(`${width}: 크라켄 점수 — 빈 보석 칸 다섯 줄은 api 문장으로 접히고, 목록 아래 문장은 그대로 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${characterPath("실목록1사유", "specup")}&sort=KRAKEN`);
    await page.getByRole("table", { name: /스펙업 후보/ }).locator("tbody tr").first().waitFor();
    const folded = page.getByRole("region", { name: "아직 계산하지 않은 후보" });
    await expect(folded.locator("summary").filter({ hasText: API_REASON })).toHaveText(`보석 5개 — ${API_REASON}`);
    await expect(page.getByText("이 항목은 크라켄 점수를 아직 계산하지 않았어요.")).toHaveCount(0);
    await expect(page.getByText("보여 드린 36개 중 24개는 전투력을 아직 계산하지 않았어요.", { exact: true })).toBeVisible();
  });

  test(`${width}: 효율 — 같은 줄은 순위에 있고 크라켄 점수 까닭은 보이지 않는다 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${characterPath("실목록1사유", "specup")}&sort=EFFICIENCY`);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    await expect(table.locator("tbody tr").filter({ hasText: "빈 보석 칸 11개" }).first()).toBeAttached();
    await expect(page.getByText(API_REASON)).toHaveCount(0);
  });
}
