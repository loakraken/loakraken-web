// 회귀(web #1965, api #1081): 스펙업 상급 재련 단계의 기대 비용(ADVANCED_REFINE_EXPECTED, status OK)을 목록이 그린다.
// 목 '실목록2상급'은 저장된 실제 목록 답(실목록2, 크라켄 점수는 limit-200 '실목록2전체')에서 상급 재련 줄의 비용만 api가 지금
// 주는 OK 비용으로 바꾼 것(금액은 합성: 120만 + 부위 번호 × 1만 G). 상급 재련 줄은 골드를 보이고, 그 근거 문장은 표 아래에
// 한 번만 나온다(같은 코드 = 같은 문장).
import { test, expect, characterPath, expectNoHorizontalOverflow } from "../support/fixtures.mjs";

for (const width of [320, 1280])
  test(`${width}: 상급 재련 줄은 기대 비용 골드, 근거 문장은 표 아래 한 번 @regression`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto(`${characterPath("실목록2상급", "specup")}&sort=KRAKEN`);
    const table = page.getByRole("table", { name: /스펙업 후보/ });
    await table.locator("tbody tr").first().waitFor();
    // The weapon's 상급 재련 (index 0, 1,200,000 G) and an armour piece's (index 5, 1,250,000 G) priced in their rows.
    for (const gold of ["120만G", "125만G"]) await expect(table.getByText(gold, { exact: true }).first()).toBeVisible();
    // Its sentence once under the table, whatever number of rows share the code.
    await expect(page.getByText(/상급 재련 기대 비용입니다/)).toHaveCount(1);
    await expectNoHorizontalOverflow(page);
  });
